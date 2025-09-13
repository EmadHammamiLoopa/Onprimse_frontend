import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Platform } from '@ionic/angular';
import { ElementRef, Injectable, NgZone } from '@angular/core';
import Peer, { MediaConnection, PeerJSOption } from 'peerjs';
import { PermissionService } from './permission.service';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserService } from './user.service';
import { ToastService } from './toast.service';
import { User } from '../models/User';
import { SocketService } from './socket.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { DeviceManagerService } from './device-manager.service';
import { VideoEvents } from '../pages/messages/chat/video/events';

interface MissedCall {
  userId: string;
  userName: string;
  timestamp: string;
  userAvatar?: string;
}
type MaybeWrapped<T> = T | { data: T };

function unwrapUser(resp: MaybeWrapped<User>): User {
  const anyResp = resp as any;
  return (anyResp && typeof anyResp === 'object' && 'data' in anyResp)
    ? (anyResp.data as User)
    : (resp as User);
}

@Injectable({ providedIn: 'root' })
export class WebrtcService {
  static peer: Peer;
  myStream: MediaStream;
  public myEl?: HTMLVideoElement;
  public partnerEl?: HTMLVideoElement;
  private latestRemoteStream: MediaStream | null = null;
  user: User = new User(); // ✅ Added user property here
  private peerHeartbeatInterval: any;
  private missedCallsSubject = new BehaviorSubject<MissedCall[]>([]);
  public missedCalls$ = this.missedCallsSubject.asObservable();
  private deviceChangeListener: () => void;
  private activeStreams: Map<string, MediaStream> = new Map(); // Track streams by tabId
  private tabId = Math.random().toString(36).substring(2, 9); // Unique tab ID
  private isClosed = false;
  private activeDevices: { video?: string, audio?: string } = {};
  private deviceLockChannel?: BroadcastChannel;
  myPeerId: string;
  public localStream: MediaStream | null = null;
  stun = 'stun.l.google.com:19302';
  mediaConnection: MediaConnection;
  options: PeerJSOption;
  stunServer: RTCIceServer = { urls: 'stun:' + this.stun, };
  static call;
  facingMode = "user";
  public partnerId?: string;
  public userId?: string;
  private missedHandlersBound = false;

  constructor(
    private androidPermission: AndroidPermissions,
    private permissionService: PermissionService,
    private router: Router,
    private nativeStorage: NativeStorage,
    private socketService: SocketService,
    private userService: UserService,
    private toastService: ToastService,
    private zone: NgZone,
    private deviceManager: DeviceManagerService
  ) {
    this.options = { key: 'cd1ft79ro8g833di', debug: 3 };
    this.loadMissedCallsFromStorage();

    // Safely set up device change listener
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      this.deviceChangeListener = () => {
        this.handleDeviceChange();
        this.refreshDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener);
    } else {
      console.warn('MediaDevices API not available');
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.deviceLockChannel = new BroadcastChannel('device_locks');
      this.deviceLockChannel.onmessage = (event) => {
        if (event.data.type === 'release' && this.activeDevices[event.data.kind] === event.data.deviceId) {
          delete this.activeDevices[event.data.kind];
        }
      };
    }
  }

  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 🔁 Retry getUserMedia in case of temporary device lock
  private async tryGetMediaStreamWithRetries(
    constraints: MediaStreamConstraints,
    retries: number = 3,
    delay: number = 500
  ): Promise<MediaStream> {
    for (let i = 0; i < retries; i++) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        if (i === retries - 1) throw error;
        console.warn(`🔁 Retry (${i + 1}) after error:`, error);
        await this.delay(delay);
      }
    }
    throw new Error("Failed to get media stream after retries");
  }

  // ✅ Main function: acquire stream with specific devices and tab locking
  async getStreamForTabWithDeviceIds(videoId: string, audioId: string, tabId: string): Promise<MediaStream | null> {
    console.log(`[webrtc] 🎥 trying getUserMedia with:\n→ video deviceId: ${videoId}\n→ audio deviceId: ${audioId}\n→ tabId: ${tabId}`);

    // 1. Release any currently active stream
    if (this.myStream) {
      console.log('[webrtc] 🔁 Releasing previous stream');
      this.myStream.getTracks().forEach(track => track.stop());
      this.myStream = null;
    }

    // 2. Check if devices are locked
    const isVideoAvailable = await this.deviceManager.acquireDevice(videoId, tabId);
    const isAudioAvailable = await this.deviceManager.acquireDevice(audioId, tabId);
    if (!isVideoAvailable || !isAudioAvailable) {
      console.warn('🔒 One or both devices are locked by another tab.');
      return null;
    }

    // 3. Try to get media stream with retries
    const MAX_RETRIES = 3;
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: videoId } },
          audio: { deviceId: { exact: audioId } }
        });
        this.myStream = stream;
        console.log('[webrtc] ✅ Acquired stream successfully.');
        return stream;
      } catch (error: any) {
        attempts++;
        if (error.name === 'OverconstrainedError') {
          console.warn(`🔁 Retry (${attempts}) after OverconstrainedError for tab ${tabId}`);
          await this.delay(500); // delay between retries
        } else {
          console.error('❌ Failed to get media stream:', error);
          break;
        }
      }
    }

    // 4. Release the locks if acquisition failed
    this.deviceManager.releaseDevice(videoId, tabId);
    this.deviceManager.releaseDevice(audioId, tabId);

    return null;
  }
  ngOnDestroy() {
    // Clean up device change listener
    if (this.deviceChangeListener && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener);
    }

    // Clean up BroadcastChannel
    if (this.deviceLockChannel) {
      this.deviceLockChannel.close();
    }

    // Ensure all resources are released
    this.close();
  }

  private get peer(): Peer {
    return WebrtcService.peer;
  }

  /** Start an outgoing call and keep a reference to it */
  /** webrtc.service.ts ───────────────────────────────────────────────────
   * Start an outgoing video-call. (user-id → peer-id)
   * – guarantees our own PeerJS instance is OPEN
   * – resolves the partner’s current peer-id
   * – pings the peer before dialling
   * – emits the “video-call-started” socket event
   * – returns the MediaConnection so the caller can attach <stream> events
   * */
  public async startCall(
    partnerUserId : string, // <-- pass USER-ID here
    localStream : MediaStream // <-- already opened camera/mic
  ): Promise<MediaConnection> {
    this.isClosed = false; // ✅ allow reinitialization
    if (!WebrtcService.peer) {
      await this.createPeer(this.userId); // fallback
    }

    /* 0 — sanity checks -------------------------------------------------- */
    if (!localStream) {
      throw new Error('Local MediaStream missing');
    }
    if (!this.userId) {
      throw new Error('auth userId not set');
    }

    /* 1 — make sure *our* peer is ready --------------------------------- */
    await this.createPeer(this.userId); // no-op if it already exists
    await this.waitForPeerOpen(); // throws after 10 s timeout

    /* 2 — look-up partner’s current peer-id ------------------------------ */
    const partnerPeerId = await this.userService
      .getPartnerPeerId(partnerUserId)
      .toPromise();
    if (!partnerPeerId) {
      throw new Error('Partner is offline or has no peer-id');
    }



    /* 4 — dial! ---------------------------------------------------------- */
    const mc = this.peer.call(
      partnerPeerId,
      localStream,
      { sdpTransform: preferVp8 } // keep the VP8 tweak
    );
    WebrtcService.call = mc; // store globally

    const connected = () => this.callState.next({ connected: true, type: 'caller' });
    let remoteAttached = false;
    
    mc.once('stream', (remote) => {
      if (remoteAttached) return;
      remoteAttached = true;
      this.attachRemoteStream(this.partnerEl!, remote, connected);
    });
    
    mc.peerConnection?.addEventListener('track', (ev) => {
      const [remote] = ev.streams;
      if (remote && !remoteAttached) {
        remoteAttached = true;
        this.attachRemoteStream(this.partnerEl!, remote, connected);
      }
    });
    

    /* 5 — emit “video-call-started” via socket --------------------------- */
    try {
      const sock = await SocketService.getSocket(); // static helper in your svc
      sock?.emit('video-call-started', {
        from : this.userId,
        to : partnerUserId,
        myPeerId : this.getPeerId(),
        partnerPeerId
      });
    } catch {
      /* socket not critical – ignore */
    }

    return mc;
  }

  public async getOptimalMediaStream(): Promise<MediaStream> {
    try {
      // Get available devices with locking
      const videoDeviceId = await this.deviceManager.getAvailableDevice('videoinput', this.tabId);
      const audioDeviceId = await this.deviceManager.getAvailableDevice('audioinput', this.tabId);
      if (!videoDeviceId || !audioDeviceId) {
        throw new Error('All devices are currently in use');
      }

      // Store the acquired device IDs
      this.activeDevices = { video: videoDeviceId, audio: audioDeviceId };
      console.log('Using devices:', { video: videoDeviceId, audio: audioDeviceId });

      // Create stream with acquired devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 30 },
          deviceId: { exact: videoDeviceId }
        },
        audio: { deviceId: { exact: audioDeviceId } }
      });

      // Log the actual devices being used
      stream.getTracks().forEach(track => {
        const settings = track.getSettings();
        console.log(`Active ${track.kind}:`, {
          deviceId: settings.deviceId,
          label: track.label,
          ...settings
        });
      });

      return stream;
    } catch (error) {
      console.error('Error acquiring optimal media stream:', error);

      // Fallback strategy with device locking
      try {
        console.log('Attempting fallback with relaxed constraints');
        const fallbackStream = await this.getFallbackMediaStream();

        // Update active devices with whatever worked in fallback
        fallbackStream.getTracks().forEach(track => {
          const settings = track.getSettings();
          if (track.kind === 'video') {
            this.activeDevices.video = settings.deviceId;
          } else if (track.kind === 'audio') {
            this.activeDevices.audio = settings.deviceId;
          }
        });

        return fallbackStream;
      } catch (fallbackError) {
        console.error('Fallback media acquisition failed:', fallbackError);
        throw new Error(
          'Could not acquire any media devices. Please check your camera and microphone permissions.'
        );
      }
    }
  }

  public setVideoElements(my: HTMLVideoElement, partner: HTMLVideoElement) {
    this.myEl = my;
    this.partnerEl = partner;

    /* replay local stream (after navigation) */
    if (this.myStream) this.myEl.srcObject = this.myStream;

    /* replay remote stream (after navigation) */
    if (this.latestRemoteStream) this.partnerEl.srcObject = this.latestRemoteStream;
  }

  public clearVideoElements() {
    this.myEl = this.partnerEl = undefined;
  }
  public async listAllMediaDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log("📷📢 Available media devices:");
      devices.forEach((device, index) => {
        console.log(`[${index}] ${device.kind}: "${device.label || '(label hidden)'}" (deviceId: ${device.deviceId})`);
      });
    } catch (err) {
      console.error("❌ Failed to list media devices:", err);
    }
  }

  private async getFallbackMediaStream(): Promise<MediaStream> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioDevices = devices.filter(d => d.kind === 'audioinput');

    // Try each video device until one works
    for (const videoDevice of videoDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: videoDevice.deviceId } },
          audio: audioDevices.length > 0 ? { deviceId: { exact: audioDevices[0].deviceId } } : true
        });
        return stream;
      } catch (videoError) {
        console.log(`Video device ${videoDevice.deviceId} failed, trying next...`);
      }
    }

    // If all video devices failed, try audio only
    for (const audioDevice of audioDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: audioDevice.deviceId } },
          video: false
        });
        return stream;
      } catch (audioError) {
        console.log(`Audio device ${audioDevice.deviceId} failed, trying next...`);
      }
    }

    throw new Error('No available media devices found');
  }

  public getMissedCalls(): MissedCall[] {
    return this.missedCallsSubject.value;
  }

  // Update registerMissedCall to prevent duplicates and include names
  public async registerMissedCall(userId: string): Promise<void> {
    try {
      const current = this.missedCallsSubject.value || [];
      const now = Date.now();
      if (current.some(c => c.userId === userId && now - new Date(c.timestamp).getTime() < 60_000)) return;
  
      let userName: string | undefined;
      let userAvatar: string | undefined;
      try {
        const resp = await this.userService.getUserProfile(userId).toPromise();
        const u = unwrapUser(resp as MaybeWrapped<User>);
        userName   = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || undefined;
        userAvatar = u?.mainAvatar;
      } catch {}
  
      const newCall = {
        userId,
        userName: userName || `User ${userId.slice(0, 6)}`,
        userAvatar,
        timestamp: new Date().toISOString(),
      };
  
      const updated = [newCall, ...current];
      localStorage.setItem('missedCalls', JSON.stringify(updated));
  
      this.zone.run(() => this.missedCallsSubject.next(updated));  // ⬅ important
      console.log('📒 missed-call stored:', newCall);
    } catch (e) {
      console.error('Error registering missed call:', e);
    }
  }
  // Update clearMissedCalls
  clearMissedCalls(): void {
    localStorage.removeItem('missedCalls');
    this.zone.run(() => this.missedCallsSubject.next([]));          // ⬅ important
  }

  public addMissedCall(call: MissedCall): void {
    const current = this.missedCallsSubject.value || [];
    const isDup = current.some(c =>
      c.userId === call.userId &&
      Math.abs(new Date(c.timestamp).getTime() - new Date(call.timestamp).getTime()) < 60_000
    );
    if (isDup) return;
  
    const updated = [call, ...current];
    localStorage.setItem('missedCalls', JSON.stringify(updated));
    this.zone.run(() => this.missedCallsSubject.next(updated));     // ⬅ important
  }

  // webrtc.service.ts
  addMissedCallFromSignaling(ev: any, myId: string) {
    const callerId = ev.callerId ?? ev.from;
    const calleeId = ev.calleeId ?? ev.to;
    const reason = ev.reason ?? ev.type; // 'cancel' | 'timeout' | ...
    const iAmCallee = myId === calleeId;
    const isMissed = reason === 'timeout' || reason === 'cancel';
    if (!(iAmCallee && isMissed)) return; // <-- ignore for caller

    this.addMissedCall({
      userId: callerId,
      userName: ev.callerName ?? ev.fromName ?? 'Unknown',
      timestamp: ev.at ?? new Date().toISOString()
    });
  }

  loadMissedCallsFromStorage(): void {
    try {
      const stored = localStorage.getItem('missedCalls');
      const parsed: MissedCall[] = stored ? JSON.parse(stored) : [];
      this.zone.run(() => this.missedCallsSubject.next(parsed));    // ⬅ important
    } catch (err) {
      console.error('Error loading missed calls:', err);
      this.zone.run(() => this.missedCallsSubject.next([]));        // ⬅ important
    }
  }

// change signature
public async bindMissedCallSocketHandlers() {
  const sock = await SocketService.getSocket();
  if (!sock || this.missedHandlersBound) return;

  const asReceiver = (ev: any) => {
    const toId = ev?.to?._id || ev?.to;
    const fromId = ev?.from?._id || ev?.from;
    if (!this.userId || !toId || !fromId) return;
    if (toId !== this.userId) return;         // only the callee records
    console.log('[missed][svc] event →', ev?.type || ev?.reason || 'unknown', 'from', fromId);

    this.registerMissedCall(fromId);
  };

  const names = [
    'video-canceled',
    'video-call-cancelled',
    'cancel-video',            // ⬅ add this
    'video-call-timeout',
    'missed-call',
    VideoEvents.CANCELED as any,
    VideoEvents.TIMEOUT as any,
    VideoEvents.MISSED as any,
  ];

  names.forEach(n => sock.off(n));
  names.forEach(n => sock.on(n, asReceiver));
  this.missedHandlersBound = true;
  console.log('[missed][svc] socket handlers bound');

}

  
  getMedia(facingMode: string) {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode },
      audio: true
    })
    .then((stream) => {
      this.handleSuccess(stream);
      return true
    }, err => {
      this.handleError(err);
      return false
    })
  }

  async init(myEl: HTMLVideoElement, partnerEl: HTMLVideoElement): Promise<boolean> {
    try {
      // ✅ First validate and store the elements
      if (!myEl || !partnerEl) {
        console.error("❌ Cannot initialize WebRTC: video elements are undefined");
        return false;
      }
      this.myEl = myEl;
      this.partnerEl = partnerEl;

      // ✅ Then request permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) return false;

      // ✅ Finally get the media stream
      this.myStream = await this.getUserMedia();
      if (!this.myStream) return false;

      this.myEl.srcObject = this.myStream;
      console.log("✅ Media stream initialized with device:",
        this.myStream.getVideoTracks()[0]?.label || 'No video',
        this.myStream.getAudioTracks()[0]?.label || 'No audio'
      );
      return true;
    } catch (error) {
      console.error("WebRTC initialization failed:", error);
      return false;
    }
  }

  getPeerId(): string | null {
    if (this.myPeerId) return this.myPeerId;
    if (WebrtcService.peer?.id) return WebrtcService.peer.id;
    const fromLS = localStorage.getItem('peerId');
    return fromLS ?? null;
  }
  

  // webrtc.service.ts
  async handleDeviceChange() {
    if (!this.myStream) return;

    const videoTrack = this.myStream.getVideoTracks()[0];
    const audioTrack = this.myStream.getAudioTracks()[0];

    // Check if current devices are still working
    const devices = await navigator.mediaDevices.enumerateDevices();
    const currentVideoDevice = videoTrack?.getSettings().deviceId;
    const currentAudioDevice = audioTrack?.getSettings().deviceId;

    // If current video device is no longer available, switch
    if (videoTrack && (!currentVideoDevice ||
      !devices.some(d => d.kind === 'videoinput' && d.deviceId === currentVideoDevice))) {
      console.log('Current video device unavailable, switching...');
      await this.switchToAvailableDevice('videoinput');
    }

    // Same for audio
    if (audioTrack && (!currentAudioDevice ||
      !devices.some(d => d.kind === 'audioinput' && d.deviceId === currentAudioDevice))) {
      console.log('Current audio device unavailable, switching...');
      await this.switchToAvailableDevice('audioinput');
    }
  }

  private async switchToAvailableDevice(kind: 'videoinput' | 'audioinput'): Promise<void> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const availableDevices = devices.filter(d => d.kind === kind);

    for (const device of availableDevices) {
      try {
        const constraints = { [kind]: { deviceId: { exact: device.deviceId } } };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);

        if (kind === 'videoinput') {
          const newTrack = newStream.getVideoTracks()[0];
          const oldTrack = this.myStream.getVideoTracks()[0];
          if (oldTrack) {
            this.myStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          this.myStream.addTrack(newTrack);
          this.myEl.srcObject = this.myStream;

          // Replace in peer connection if active
          if (WebrtcService.call) {
            const sender = this.getVideoSender();
            if (sender) await sender.replaceTrack(newTrack);
          }
        } else {
          const newTrack = newStream.getAudioTracks()[0];
          const oldTrack = this.myStream.getAudioTracks()[0];
          if (oldTrack) {
            this.myStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          this.myStream.addTrack(newTrack);

          // Replace in peer connection if active
          if (WebrtcService.call) {
            const sender = this.getAudioSender();
            if (sender) await sender.replaceTrack(newTrack);
          }
        }
        return; // Successfully switched
      } catch (error) {
        console.log(`Failed to switch to ${kind} device ${device.deviceId}`, error);
      }
    }

    console.error(`No available ${kind} devices could be activated`);
  }

  // webrtc.service.ts
  // Add these methods to your WebrtcService class:
  /** Refresh the list of available media devices */
  async refreshDevices(): Promise<void> {
    try {
      await navigator.mediaDevices.enumerateDevices();
      // This triggers the devicechange event which will update our device list
    } catch (error) {
      console.error('Error refreshing devices:', error);
    }
  }

  /** Get the video sender from the current peer connection */
  private getVideoSender(): RTCRtpSender | null {
    if (!WebrtcService.call || !WebrtcService.call.peerConnection) {
      return null;
    }
    const senders = WebrtcService.call.peerConnection.getSenders();
    return senders.find(sender => sender.track?.kind === 'video') || null;
  }

  /** Get the audio sender from the current peer connection */
  private getAudioSender(): RTCRtpSender | null {
    if (!WebrtcService.call || !WebrtcService.call.peerConnection) {
      return null;
    }
    const senders = WebrtcService.call.peerConnection.getSenders();
    return senders.find(sender => sender.track?.kind === 'audio') || null;
  }
  private startPeerIdHeartbeat(userId: string, peerId: string) {
    if (this.peerHeartbeatInterval) {
      clearInterval(this.peerHeartbeatInterval);
    }
    this.peerHeartbeatInterval = setInterval(() => {
      this.userService.heartbeatPeer(userId) // new lightweight call
        .catch(err => console.error('❌ heartbeat failed:', err));
    }, 60_000); // every 60 s
  }

  // webrtc.service.ts ── just replace the whole method
  // ✅ keep THIS one
  public waitForPeerOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      /* 🚦 1 — make sure the Peer instance exists */
      if (!WebrtcService.peer) {
        return reject(new Error('PeerJS instance not created yet'));
      }

      /* 🚦 2 — already open … */
      if (WebrtcService.peer.open) return resolve();

      /* 🚦 3 — wait max 10 s … */
      const timeout = setTimeout(
        () => reject(new Error('⏰ peer.open timeout (20 s)')),
        20_000
      );

      WebrtcService.peer.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private creatingPeer = false;

  private spawnPeer(candidateId: string, authUserId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try { WebrtcService.peer?.destroy(); } catch {}
      WebrtcService.peer = new Peer(candidateId, {
        host : 'peerjs-whei.onrender.com',
        port : 443,
        secure : true,
        path : '/peerjs',
        debug: 2,
        pingInterval: 25000,
        config : {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
  
// webrtc.service.ts → spawnPeer(): after setting userId
WebrtcService.peer.once('open', async () => {
  this.myPeerId = candidateId;
  this.userId = authUserId;
  localStorage.setItem('peerId', candidateId);
  try { await this.userService.sendPeerIdToBackend(authUserId, candidateId); } catch {}
  this.startPeerIdHeartbeat(authUserId, candidateId);

    // ✅ ensure missed-call handlers are attached
  await this.bindMissedCallSocketHandlers();
  this.wait();

  resolve();
});

  
      WebrtcService.peer.once('error', (err: any) => {
        reject(err);
      });
    });
  }
  
  private makeCandidateId(base: string) {
    // short, URL-safe suffix
    return `${base}-${Math.random().toString(36).slice(2,6)}`;
  }
  
  async createPeer(authUserId: string): Promise<void> {
    if (this.creatingPeer) return;
    if (WebrtcService.peer && WebrtcService.peer.open) return;
    this.creatingPeer = true;
  
    try {
      // Try a fresh suffixed ID first (avoids collisions / zombie sessions)
      let candidate = this.makeCandidateId(authUserId);
      try {
        await this.spawnPeer(candidate, authUserId);
        return;
      } catch (e: any) {
        if (e?.type !== 'unavailable-id') throw e;
      }
  
      // Try another suffix
      candidate = this.makeCandidateId(authUserId);
      try {
        await this.spawnPeer(candidate, authUserId);
        return;
      } catch (e: any) {
        if (e?.type !== 'unavailable-id') throw e;
      }
  
      // Fallback: plain base id as last resort
      await this.spawnPeer(authUserId, authUserId);
    } finally {
      this.creatingPeer = false;
    }
  }

  async getPartnerUser(partnerId: string): Promise<User | null> {
    try {
      const user = await this.userService.getUserProfile(partnerId).toPromise();
      console.log("userService.getUserProfile(", user);
      return user || null; // Return the user object or null if undefined
    } catch (error) {
      console.error("❌ Error fetching partner user:", error);
      return null;
    }
  }

  // Add to WebrtcService
  private callState = new BehaviorSubject<{connected: boolean, type: 'caller' | 'receiver'}>(null);
  public callState$ = this.callState.asObservable();

  async getUserMedia(): Promise<MediaStream | null> {
    // Reuse a live stream if we already have one
    if (this.myStream && this.myStream.getTracks().some(t => t.readyState === 'live')) {
      return this.myStream;
    }
  
    try {
      // Acquire specific devices (with your locking)
      const videoDeviceId = await this.deviceManager.getAvailableDevice('videoinput', this.tabId);
      const audioDeviceId = await this.deviceManager.getAvailableDevice('audioinput', this.tabId);
      if (!videoDeviceId || !audioDeviceId) {
        throw new Error('All devices are currently in use');
      }
  
      // Remember intended devices
      this.activeDevices = { video: videoDeviceId, audio: audioDeviceId };
  
      // Create the stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 30 },
          deviceId: { exact: videoDeviceId }
        },
        audio: { deviceId: { exact: audioDeviceId } }
      });
  
      // ✅ Keep references so close() can stop tracks reliably
      this.myStream = stream;
      this.activeStreams.set(this.tabId, stream);
  
      // Update activeDevices with what the browser actually picked
      stream.getTracks().forEach(track => {
        const id = track.getSettings().deviceId;
        if (track.kind === 'video' && id) this.activeDevices.video = id;
        if (track.kind === 'audio' && id) this.activeDevices.audio = id;
      });
  
      return stream;
  
    } catch (error) {
      console.error('Error acquiring media:', error);
  
      // Fallback: relaxed constraints
      try {
        console.log('Attempting fallback with relaxed constraints');
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
  
        // ✅ Also keep references for fallback
        this.myStream = fallbackStream;
        this.activeStreams.set(this.tabId, fallbackStream);
  
        // Best-effort: record actual devices used
        this.activeDevices = {};
        fallbackStream.getTracks().forEach(track => {
          const id = track.getSettings().deviceId;
          if (track.kind === 'video' && id) this.activeDevices.video = id;
          if (track.kind === 'audio' && id) this.activeDevices.audio = id;
        });
  
        return fallbackStream;
  
      } catch (fallbackError) {
        console.error('Fallback media acquisition failed:', fallbackError);
        this.toastService.presentStdToastr(
          'All cameras/microphones are in use. Please close other applications using these devices and try again.'
        );
        return null;
      }
    }
  }
  
  private async attachRemoteStream(
    el: HTMLVideoElement,
    stream: MediaStream,
    afterConnected: () => void,
  ) {
    el.srcObject = stream;

    /* Kick off playback */
    const resume = () => {
      const p = el.play();
      if (p !== undefined) {
        p.catch(() => setTimeout(resume, 100)); // retry if autoplay blocked
      }
    };

    if (el.readyState >= 1) {
      resume(); // metadata is already available
    } else {
      el.onloadedmetadata = resume; // wait until it is
    }
    afterConnected();
  }
  private releaseCurrentStream() {
    if (this.activeStreams.has(this.tabId)) {
      const stream = this.activeStreams.get(this.tabId);
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      this.activeStreams.delete(this.tabId);
    }

    // Release any device locks
    if (this.activeDevices.video) {
      this.deviceManager.releaseDevice(this.activeDevices.video, this.tabId);
    }
    if (this.activeDevices.audio) {
      this.deviceManager.releaseDevice(this.activeDevices.audio, this.tabId);
    }
    this.activeDevices = {};
  }

  // Store missed call when recipient is offline
  async storeMissedCall(userId: string) {
    const missedCalls = JSON.parse(localStorage.getItem("missedCalls") || "[]");

    // Avoid duplicates:
    if (missedCalls.some(call => call.userId === userId)) {
      console.log(`❗ Missed call for ${userId} already exists`);
      return;
    }

    // Get partner name (optional but better UX)
    let userName = userId;
    try {
      const partner = await this.userService.getUserProfile(userId).toPromise();
      userName = `${partner.firstName} ${partner.lastName}`;
    } catch (err) {
      console.warn("⚠ Could not fetch partner name");
    }

    missedCalls.push({
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem("missedCalls", JSON.stringify(missedCalls));
    this.missedCallsSubject.next(missedCalls); // ✅ not missedCalls$
    console.log(`🔔 Missed call stored for ${userName}`);
  }

  notifyMissedCalls() {
    const missedCalls = JSON.parse(localStorage.getItem('missedCalls')) || [];
    if (missedCalls.length > 0) {
      alert(`📞 You have ${missedCalls.length} missed call(s)!`);
      localStorage.removeItem('missedCalls'); // Clear after notifying
    }
  }

  async requestPermissions() {
    try {
      await this.permissionService.getPermission(this.androidPermission.PERMISSION.CAMERA);
      await this.permissionService.getPermission(this.androidPermission.PERMISSION.RECORD_AUDIO);
      await this.permissionService.getPermission(this.androidPermission.PERMISSION.MODIFY_AUDIO_SETTINGS);
    } catch (err) {
      console.error("❌ Permission error:", err);
      return false;
    }
    return true;
  }

  async wait() {
    console.log("📡 Waiting for incoming calls...");
    WebrtcService.peer.off("call");
    WebrtcService.peer.on("call", async (call) => {
      console.log('[peer:rx] incoming from', call.peer);
  
      try {
        // ✅ DO NOT open camera here. Just remember the call.
        WebrtcService.call = call;
        const partnerId = call.peer.split('-')[0];
        this.partnerId = partnerId;
        localStorage.setItem('partnerId', partnerId);
  
        // Navigate to the screen that shows Accept/Decline UI
        if (!this.router.url.includes('/messages/video')) {
          await this.router.navigate(
            ['/messages/video', partnerId],
            { queryParams: { answer: true }, state: { incomingCall: true } }
          );
        }
  
        // Basic safety handlers
        call.on("close", () => {
          console.log("📴 Call closed by remote peer");
          if (this.partnerEl) this.partnerEl.srcObject = null;
        });
        call.on("error", (err) => {
          console.error("❌ Call error:", err);
          if (this.partnerEl) this.partnerEl.srcObject = null;
        });
  
      } catch (error) {
        console.error("❌ Error handling incoming call:", error);
        try { call.close(); } catch {}
      }
    });
  }
  

  // ✅ Function to check if the peer is online
  async checkPeerOnline(peerId: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try { conn?.close(); } catch {}
        resolve(ok);
      };
  
      const conn = WebrtcService.peer.connect(peerId, { reliable: false });
      const t = setTimeout(() => finish(false), 2000); // hard 2s cap
  
      conn.on('open',  () => { clearTimeout(t); finish(true);  });
      conn.on('error', () => { clearTimeout(t); finish(false); });
      conn.on('close', () => { clearTimeout(t); finish(false); });
    });
  }
  

  handleSuccess(stream: MediaStream) {
    this.myStream = stream;
    if (!this.myEl) {
      console.warn("⚠️ Video element not ready yet. Stream will be assigned later.");
      return;
    }
    try {
      this.myEl.srcObject = stream;
      this.myEl.muted = true; // Important for local playback
      console.log("✅ Stream successfully assigned to video element");
    } catch (error) {
      console.error("❌ Error assigning stream to video element:", error);
    }
  }

  handleError(error: any) {
    if (error.name === 'NotReadableError') {
      this.toastService.presentStdToastr(
        'Camera/mic is being used by another app. ' +
        'Please close other applications using your devices.'
      );
    }
    if (error.name === 'ConstraintNotSatisfiedError') {
      this.errorMsg(`The resolution px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
      this.errorMsg(
        'Permissions have not been granted to use your camera and ' +
        'microphone, you need to allow the page access to your devices in ' +
        'order for the demo to work.'
      );
    }
    this.errorMsg(`getUserMedia error: ${error.name}`, error);
  }

  errorMsg(msg: string, error?: any) {
    const errorElement = document.querySelector('#errorMsg');
    if (errorElement) {
      errorElement.innerHTML += `<p>${msg}</p>`;
    }
    if (typeof error !== 'undefined') {
      console.error(error);
    }
  }
  /* ────────────────────────────────────────────────────────────────────────────
   * webrtc.service.ts ▸ replace the whole answer() with this function
   *────────────────────────────────────────────────────────────────────────────*/
  async answer(call?: MediaConnection) {
    if (!this.myStream || !this.myStream.getVideoTracks().length){
      console.warn('[answer] no video – grabbing camera');
      this.myStream = await this.getOptimalMediaStream();
      if (!this.myStream) return console.error('[answer] still no cam');
    }

    const activeCall = call || WebrtcService.call;
    if (!activeCall) return console.error('[answer] no call object');

    console.log('📞 [answer] answering', activeCall.peer);
    activeCall.answer(this.myStream);
    this.callState.next({connected:false, type:'receiver'});

    activeCall.peerConnection.addEventListener(
      'iceconnectionstatechange',
      () => console.log('🌐 [ICE-RX] →', activeCall.peerConnection.iceConnectionState)
    );

    /* attach once */
    let remoteAttached = false;
    const attach = (remote: MediaStream, src: 'stream' | 'track') => {
      this.latestRemoteStream = remote; // ① remember it
      if (!this.partnerEl) return; // ② maybe page not ready yet

      this.partnerEl.srcObject = remote;
      if (remoteAttached) return;
      remoteAttached = true;

      console.log(`🎬 [RX ${src}] tracks=`, remote.getTracks().map(t=>`${t.kind}:${t.readyState}`).join(', '));

      const wait = () => this.partnerEl ? start() : setTimeout(wait, 50);
      const start = () => {
        console.log('🖇 [receiver] set srcObject');
        this.partnerEl!.srcObject = remote;
        this.partnerEl!.muted = true;

        const play = () => this.partnerEl!.play()
          .then(()=>console.log('▶️ [receiver] video playing (muted)'))
          .catch(e=>{
            console.warn('⏸ retry play()',e);
            setTimeout(play,120);
          });

        this.partnerEl!.onloadedmetadata = play;
        play();

        const unmute = () => {
          this.partnerEl!.muted = false;
          this.partnerEl!.play().catch(()=>{});
          console.log('🔊 [receiver] un-muted by user');
          document.removeEventListener('click', unmute);
        };
        document.addEventListener('click', unmute, {once:true});

        this.callState.next({connected:true, type:'receiver'});
      };
      wait();
    };

    activeCall.on('track', (e:any)=>attach(e.streams[0],'track'));
    activeCall.on('stream', s =>attach(s, 'stream'));
    activeCall.on('close', ()=>{
      console.log('🔚 [answer] closed');
      this.callState.next(null);
    });
    activeCall.on('error', e=>{
      console.error(e);
    });
  }

  public async close(opts?: { silent?: boolean }): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    const silent = !!opts?.silent;

    console.log("🛑 Closing WebRTC connections and releasing devices...");

    // Release device locks
    if (this.activeDevices.video) {
      this.deviceManager.releaseDevice(this.activeDevices.video, this.tabId);
      this.deviceLockChannel?.postMessage({ type: 'release', kind: 'video', deviceId: this.activeDevices.video });
    }
    if (this.activeDevices.audio) {
      this.deviceManager.releaseDevice(this.activeDevices.audio, this.tabId);
      this.deviceLockChannel?.postMessage({ type: 'release', kind: 'audio', deviceId: this.activeDevices.audio });
    }

    if (this.peerHeartbeatInterval) {
      clearInterval(this.peerHeartbeatInterval);
      this.peerHeartbeatInterval = null;
    }
    
    this.activeDevices = {};

    // Peer connection
    if (WebrtcService.call) {
      try { WebrtcService.call.close(); } catch {}
      WebrtcService.call = null;
    }

    // Media streams
    if (this.myStream) {
      this.myStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
        t.enabled = false;
      });
      this.myStream = null;
    }

    // Video elements
    if (this.myEl) this.myEl.srcObject = null;
    if (this.partnerEl) this.partnerEl.srcObject = null;

    // ✅ Only emit ENDED when *we* initiated the hangup
    if (!silent && this.userId && this.partnerId) {
      const sock = await SocketService.getSocket();
      if (sock?.connected) {
        sock.emit(VideoEvents.ENDED, { from: this.userId, to: this.partnerId });
        sock.emit('leave-call', { room: this.partnerId });
        // If your enum name differs from backend literal, keep both:
        if (VideoEvents.ENDED !== 'video-call-ended') {
          sock.emit('video-call-ended', { from: this.userId, to: this.partnerId });
        }
      }
    }
    this.callState.next(null);
  }

  toggleCamera() {
    this.myStream.getVideoTracks()[0].enabled = !this.myStream.getVideoTracks()[0].enabled;
    return this.myStream.getVideoTracks()[0].enabled;
  }

  toggleAudio() {
    this.myStream.getAudioTracks()[0].enabled = !this.myStream.getAudioTracks()[0].enabled;
    return this.myStream.getAudioTracks()[0].enabled;
  }

  toggleCameraDirection() {
    this.facingMode = this.facingMode == 'user' ? 'environment' : 'user';
    this.getMedia(this.facingMode);
  }
}
/** Move every VP8 payloadId to the front of the m=video line. */
/** preferVp8 v2 – no duplicate payload-ids */
function preferVp8(sdp: string): string {
  const lines = sdp.split('\r\n');
  let mLineIndex = -1;
  const vp8Ids: string[] = [];

  lines.forEach((l, i) => {
    if (l.startsWith('m=video')) mLineIndex = i;
    const m = l.match(/^a=rtpmap:(\d+)\s+VP8\/90000/i);
    if (m) vp8Ids.push(m[1]);
  });

  if (mLineIndex !== -1 && vp8Ids.length) {
    const parts = lines[mLineIndex].trim().split(' ');
    const header = parts.slice(0, 3); // ← was 4
    const restIds = parts.slice(3);
    const newList = [
      ...vp8Ids,
      ...restIds.filter(id => !vp8Ids.includes(id))
    ];
    lines[mLineIndex] = [...header, ...newList].join(' ');
  }

  return lines.join('\r\n');
}
