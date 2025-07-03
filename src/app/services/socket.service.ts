import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import constants from '../helpers/constants';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private static socketInstance: Socket | null = null;
  private static initializationPromise: Promise<void> | null = null;
  private static reconnectionInProgress = false;

  static async initializeSocket(): Promise<void> {
    if (SocketService.socketInstance?.connected) {
      return Promise.resolve();
    }
    if (SocketService.reconnectionInProgress) {
      return SocketService.initializationPromise || Promise.reject(new Error('Connection in progress'));
    }
    SocketService.reconnectionInProgress = true;

    SocketService.initializationPromise = new Promise(async (resolve, reject) => {
      console.log('🔵 Initializing WebSocket connection...');

      if (SocketService.socketInstance) {
        SocketService.socketInstance.removeAllListeners();
        SocketService.socketInstance.disconnect();
      }

      // ✅ READ JWT TOKEN FROM STORAGE
      let token: string | null = null;
      token = localStorage.getItem('token'); // Or NativeStorage if on device

      if (!token) {
        console.warn('❌ No token found, skipping WebSocket initialization');
        reject(new Error('Missing token'));
        return;
      }

      SocketService.socketInstance = io(constants.DOMAIN_URL, {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        auth: { token: token }, // ✅ THIS IS CRITICAL FOR JWT SOCKET AUTH
      });

      const connectionTimeout = setTimeout(() => {
        console.warn('⌛ WebSocket connection timeout');
        reject(new Error('Connection timeout'));
        SocketService.reconnectionInProgress = false;
      }, 30000);

      SocketService.socketInstance.on('connect', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket Connected:', SocketService.socketInstance?.id);
        SocketService.reconnectionInProgress = false;
        resolve();
      });

      SocketService.socketInstance.on('connect_error', (error) => {
        console.error('⚠️ WebSocket Connection Error:', error);
      });

      SocketService.socketInstance.on('disconnect', (reason) => {
        console.warn('🔄 WebSocket disconnected:', reason);
        if (reason === 'io server disconnect') {
          SocketService.socketInstance?.connect();
        }
      });
    });

    return SocketService.initializationPromise;
  }

  static registerUser(userId: string) {
    if (!SocketService.socketInstance?.connected) {
      console.warn("⚠️ Cannot register user — socket not connected yet.");
      return;
    }
    console.log("📡 Registering user:", userId);
    SocketService.socketInstance.emit('register-user', userId);
  }

  static async getSocket(): Promise<Socket> {
    if (SocketService.socketInstance) {
      return SocketService.socketInstance;
    }
    if (!SocketService.initializationPromise) {
      throw new Error('❌ WebSocket is not initialized.');
    }
    await SocketService.initializationPromise;
    if (!SocketService.socketInstance) {
      throw new Error('❌ WebSocket failed to initialize.');
    }
    return SocketService.socketInstance;
  }

  static emit(event: string, data: any): void {
    if (SocketService.socketInstance?.connected) {
      SocketService.socketInstance.emit(event, data);
    } else {
      console.warn(`⚠️ Cannot emit '${event}' — WebSocket not connected.`);
    }
  }
}
