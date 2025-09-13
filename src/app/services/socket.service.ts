import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';
import { Subject, Observable } from 'rxjs';

type UserStatus = { userId: string; online: boolean };

@Injectable({ providedIn: 'root' })
export class SocketService {
  private static socketInstance: Socket | null = null;
  private static initializationPromise: Promise<void> | null = null;
  private static reconnectionInProgress = false;

  // The ONLY id we bind to (derived from JWT)
  private static ownerId: string | null = null;

  // Offline emit queue (flushed on connect)
  private static emitQueue: Array<{ event: string; data: any }> = [];

  // Observables for app-wide consumption
  private static connectionSubject = new Subject<'connected' | 'disconnected' | 'error'>();
  static connection$: Observable<'connected' | 'disconnected' | 'error'> =
    SocketService.connectionSubject.asObservable();

  private static userStatusSubject = new Subject<UserStatus>();
  static userStatus$: Observable<UserStatus> = SocketService.userStatusSubject.asObservable();

  /** Base64url-safe decoder (for JWT payload). */
  private static base64UrlDecode(b64url: string): string {
    const pad = (s: string) => s + '==='.slice((s.length + 3) % 4);
    const b64 = pad(b64url.replace(/-/g, '+').replace(/_/g, '/'));
    try {
      return decodeURIComponent(
        atob(b64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      // Fallback if unicode decode fails
      return atob(b64);
    }
  }

  /** Safely decode JWT (no crypto validation; server validates). */
  private static extractUserIdFromToken(token: string | null): string | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      const json = this.base64UrlDecode(parts[1]);
      const payload = JSON.parse(json);
      return payload?.id || payload?.userId || payload?._id || null;
    } catch {
      return null;
    }
  }

  /** Read current auth token & compute owner id. */
  private static resolveOwnerId(): string | null {
    const token = localStorage.getItem('token');
    return SocketService.extractUserIdFromToken(token);
  }

  /** Public getter for the socket owner id. */
  static getOwnerId(): string | null {
    return SocketService.ownerId ?? SocketService.resolveOwnerId();
  }

  /** Bind the service to the authenticated user (from JWT). */
  static bindToAuthUser(): void {
    const authId = SocketService.resolveOwnerId();
    if (!authId) {
      console.warn('⚠️ No auth token / owner id; not binding socket user.');
      return;
    }
    if (SocketService.ownerId && SocketService.ownerId !== authId) {
      console.warn(
        `⚠️ Attempt to switch socket owner (${SocketService.ownerId} → ${authId}) ignored. ` +
          `Call logout() or refreshAuth() if user actually changed.`
      );
      return;
    }
    SocketService.ownerId = authId;

    // If connected, tell backend which user this socket belongs to.
    // Your server already reads JWT in handshake, but chat.js also listens to 'connect-user'.
    if (SocketService.socketInstance?.connected) {
      SocketService.socketInstance.emit('connect-user', authId);
    }
  }

  /** If token rotates (refresh), call this. */
  static async refreshAuth(): Promise<void> {
    const newAuthId = SocketService.resolveOwnerId();

    // If same user, just update socket auth payload and reconnect if needed
    if (newAuthId && newAuthId === SocketService.ownerId) {
      const token = localStorage.getItem('token');
      if (SocketService.socketInstance && token) {
        // Update auth for next handshake
        (SocketService.socketInstance as any).auth = { token };
        if (!SocketService.socketInstance.connected) {
          SocketService.socketInstance.connect();
        }
      }
      return;
    }

    // Different user or no user → full reset
    SocketService.ownerId = newAuthId ?? null;
    if (SocketService.socketInstance) {
      try { SocketService.socketInstance.removeAllListeners(); } catch {}
      try { SocketService.socketInstance.disconnect(); } catch {}
      SocketService.socketInstance = null;
    }
    SocketService.initializationPromise = null;
    SocketService.reconnectionInProgress = false;

    if (newAuthId) {
      await SocketService.initializeSocket();
      await SocketService.ensureConnected();
      SocketService.socketInstance!.emit('connect-user', newAuthId);
    }
  }

  /** Wait until actually connected. */
  static ensureConnected(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = SocketService.socketInstance;
      if (!s) return reject(new Error('Socket not created'));
      if (s.connected) return resolve();
      const onConnect = () => { s.off('connect_error', onError); resolve(); };
      const onError   = (err: any) => { s.off('connect', onConnect); reject(err); };
      s.once('connect', onConnect);
      s.once('connect_error', onError);
    });
  }

  /** Initialize the socket (idempotent, robust). */
  static async initializeSocket(): Promise<void> {
    if (SocketService.socketInstance?.connected) return Promise.resolve();
    if (SocketService.reconnectionInProgress) {
      return SocketService.initializationPromise || Promise.reject(new Error('Connection in progress'));
    }
    SocketService.reconnectionInProgress = true;

    SocketService.initializationPromise = new Promise(async (resolve, reject) => {
      console.log('🔵 Initializing WebSocket connection...');

      // Clean any stale instance
      if (SocketService.socketInstance) {
        try { SocketService.socketInstance.removeAllListeners(); } catch {}
        try { SocketService.socketInstance.disconnect(); } catch {}
      }

      const currentPath = window.location.pathname || '';
        if (currentPath.includes('signup')) {
          console.log('➡️ Signup route detected, skipping token check');
          SocketService.reconnectionInProgress = false;
          return resolve(); // skip silently
        }
      // Auth pre-check
      const token = localStorage.getItem('token');
      if (!token) {
        SocketService.reconnectionInProgress = false;
        return reject(new Error('Missing token'));
      }
      const authId = SocketService.resolveOwnerId();
      if (!authId) {
        SocketService.reconnectionInProgress = false;
        return reject(new Error('Invalid auth token (no user id)'));
      }
      SocketService.ownerId = authId;

      // Create socket
      SocketService.socketInstance = io(environment.socketUrl, {
        path: environment.socketPath || '/socket.io',
        // Keep both to survive proxies; websocket is preferred by engine.io
        transports: [ 'polling','websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        // gentle backoff window
        reconnectionDelay: 800,
        reconnectionDelayMax: 6000,
        timeout: 25000,
        auth: { token },
      });

      const onConnect = () => {
        SocketService.reconnectionInProgress = false;
        console.log('✅ WebSocket Connected:', SocketService.socketInstance?.id);
        SocketService.connectionSubject.next('connected');

        // Tell backend (for chat.js) which user this socket belongs to.
        SocketService.socketInstance!.emit('connect-user', authId);

        // Flush any queued emits
        if (SocketService.emitQueue.length) {
          const q = [...SocketService.emitQueue];
          SocketService.emitQueue.length = 0;
          q.forEach(({ event, data }) => {
            try { SocketService.socketInstance!.emit(event, data); } catch {}
          });
        }

        resolve();
      };

      const onConnectError = (error: any) => {
        console.error('⚠️ WebSocket Connection Error:', error);
        SocketService.connectionSubject.next('error');
      };

      const onDisconnect = (reason: string) => {
        console.warn('🔄 WebSocket disconnected:', reason);
        SocketService.connectionSubject.next('disconnected');
        // Server forced disconnect → try immediate reconnect
        if (reason === 'io server disconnect') {
          SocketService.socketInstance?.connect();
        }
      };

      // Guard: give up this particular init attempt after 30s,
      // but auto-reconnect continues in the background.
      const failTimer = setTimeout(() => {
        // Don't flip flags if we already connected
        if (!SocketService.socketInstance?.connected) {
          SocketService.reconnectionInProgress = false;
          reject(new Error('Connection timeout'));
        }
      }, 30000);

      SocketService.socketInstance.on('connect', () => {
        clearTimeout(failTimer);
        onConnect();
      });
      SocketService.socketInstance.on('connect_error', onConnectError);
      SocketService.socketInstance.on('disconnect', onDisconnect);

      // ✅ Safe listener for presence updates from the server
      SocketService.socketInstance.on('user-status-changed', (payload: any) => {
        // Server emits: { userId, online }
        // Be defensive to avoid "cannot read id of undefined"
        const userId: string | undefined =
          payload?.userId ?? payload?.user?.id ?? payload?.id;
        const online: boolean = !!payload?.online;

        if (!userId) {
          console.warn('⚠️ Bad user-status-changed payload:', payload);
          return;
        }

        console.log('📡 User status changed:', { userId, online });
        SocketService.userStatusSubject.next({ userId, online });
      });
    });

    return SocketService.initializationPromise;
  }

  /** Get the live socket instance (awaits initialization if needed). */
  static async getSocket(): Promise<Socket | null> {
    // ✅ Skip WebSocket when on signup route
    const currentPath = window.location.pathname || '';
    if (currentPath.includes('signup')) {
      console.log('➡️ Signup route detected, skipping socket init.');
      return null; // just return null silently
    }
  
    if (SocketService.socketInstance) return SocketService.socketInstance;
    if (!SocketService.initializationPromise) {
      throw new Error('❌ WebSocket is not initialized.');
    }
    await SocketService.initializationPromise;
    if (!SocketService.socketInstance) {
      throw new Error('❌ WebSocket failed to initialize.');
    }
    return SocketService.socketInstance;
  }
  

  /** Safe emit (queues while offline). */
  static emit(event: string, data: any): void {
    if (SocketService.socketInstance?.connected) {
      SocketService.socketInstance.emit(event, data);
    } else {
      // Queue and try to (re)connect in background
      SocketService.emitQueue.push({ event, data });
      if (!SocketService.reconnectionInProgress) {
        SocketService.initializeSocket().catch(() => void 0);
      }
      console.warn(`ℹ️ Queued '${event}' — WebSocket not connected.`);
    }
  }
  

  /** Call on real logout (or when switching accounts). */
  static async logout(): Promise<void> {
    localStorage.removeItem('token');
    SocketService.ownerId = null;
    SocketService.emitQueue.length = 0;

    if (SocketService.socketInstance) {
      try { SocketService.socketInstance.removeAllListeners(); } catch {}
      try { SocketService.socketInstance.disconnect(); } catch {}
      SocketService.socketInstance = null;
    }
    SocketService.initializationPromise = null;
    SocketService.reconnectionInProgress = false;
    SocketService.connectionSubject.next('disconnected');
  }
}
