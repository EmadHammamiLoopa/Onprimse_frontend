import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Platform } from '@ionic/angular';
import { ElementRef, Injectable } from '@angular/core';
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


interface MissedCall {
  userId: string;
  userName: string;
  timestamp: string;
  userAvatar?: string;
}

@Injectable({
  providedIn: 'root'
})


export class WebrtcService {
  static peer: Peer;
  myStream: MediaStream;
  public myEl!: HTMLVideoElement;
  public partnerEl!: HTMLVideoElement;
  
  user: User = new User(); // ✅ Added `user` property here
  private peerHeartbeatInterval: any;
  private missedCalls = new BehaviorSubject<MissedCall[]>([]);
  public  missedCalls$ = new BehaviorSubject<MissedCall[]>([]);
  private deviceChangeListener: () => void;
  private activeStreams: Map<string, MediaStream> = new Map(); // Track streams by tabId
  private tabId = Math.random().toString(36).substring(2, 9); // Unique tab ID
  private isClosed = false;
  private activeDevices: { video?: string, audio?: string } = {};
  private deviceLockChannel?: BroadcastChannel;
  userId: string;
myPeerId: string;
public peer: Peer | null = null;
public localStream: MediaStream | null = null;
  stun = 'stun.l.google.com:19302';
  mediaConnection: MediaConnection;
  options: PeerJSOption;
  stunServer: RTCIceServer = {
    urls: 'stun:' + this.stun,
  };
  static call;
  facingMode = "user";

  
  constructor(
    private androidPermission: AndroidPermissions, 
    private permissionService: PermissionService, 
    private router: Router,
    private nativeStorage: NativeStorage,
    private socketService: SocketService,
    private userService: UserService,
    private toastService: ToastService,
    private deviceManager: DeviceManagerService
  ) {
    this.options = {
      key: 'cd1ft79ro8g833di',
      debug: 3
    };
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
  
  private delay  = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        await this.delay (delay);
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

  startCall(partnerId: string): void {
    if (!this.peer || !this.localStream) {
      console.warn("⛔ Cannot start call: Peer or localStream missing");
      return;
    }
  
    const call = this.peer.call(partnerId, this.localStream);
    console.log("📞 Calling", partnerId);
  
    call.on('stream', (remoteStream) => {
      console.log("📡 Received remote stream");
      // Assign remoteStream to partnerEl in VideoComponent if needed
    });
  
    call.on('close', () => {
      console.log("🔚 Call closed");
    });
  
    call.on('error', (err) => {
      console.error("❌ Call error:", err);
    });
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
    this.activeDevices = {
      video: videoDeviceId,
      audio: audioDeviceId
    };

    console.log('Using devices:', {
      video: videoDeviceId,
      audio: audioDeviceId
    });

    // Create stream with acquired devices
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: videoDeviceId } },
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
      throw new Error('Could not acquire any media devices. Please check your camera and microphone permissions.');
    }
  }
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
    return this.missedCalls.value;
  }
  
  // Update registerMissedCall to prevent duplicates and include names
  async registerMissedCall(userId: string): Promise<void> {
    try {
      const currentCalls = this.missedCalls.value;
      
      // Check if call already exists for this user
      if (currentCalls.some(call => call.userId === userId)) {
        console.log(`Call from ${userId} already registered`);
        return;
      }
  
      // Get user details
      const user = await this.userService.getUserProfile(userId).toPromise();
      const newCall: MissedCall = {
        userId,
        userName: user ? `${user.firstName} ${user.lastName}` : `User ${userId.substring(0, 6)}`,
        userAvatar: user?.mainAvatar,
        timestamp: new Date().toISOString()
      };
  
      const updatedCalls = [newCall, ...currentCalls];
      localStorage.setItem('missedCalls', JSON.stringify(updatedCalls));
      this.missedCalls.next(updatedCalls);
      
      console.log(`Registered missed call from ${newCall.userName}`);
    } catch (error) {
      console.error('Error registering missed call:', error);
    }
  }
  
  // Update clearMissedCalls
  clearMissedCalls(): void {
    localStorage.removeItem('missedCalls');
    this.missedCalls.next([]);
    console.log('Cleared all missed calls');
  }
  
  // Update loadMissedCallsFromStorage
  loadMissedCallsFromStorage(): void {
    try {
      const stored = localStorage.getItem('missedCalls');
      const parsed: MissedCall[] = stored ? JSON.parse(stored) : [];
      this.missedCalls.next(parsed);
    } catch (error) {
      console.error('Error loading missed calls:', error);
      this.missedCalls.next([]);
    }
  }


  

  getMedia(facingMode: string) {
    return navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode
        },
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

  async init(myEl: HTMLVideoElement, partnerEl: HTMLVideoElement): Promise<boolean>
  {
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
        this.myStream.getAudioTracks()[0]?.label || 'No audio');
    
        
      return true;
    } catch (error) {
      console.error("WebRTC initialization failed:", error);
      return false;
    }
  }
  
  getPeerId(): string {

    /* (a) already cached in RAM? */
    if (this.myPeerId)                     return this.myPeerId;

    /* (b) PeerJS already knows? */
    if (WebrtcService.peer?.id)            return WebrtcService.peer.id;

    /* (c) persisted in localStorage? */
    const fromLS = localStorage.getItem('peerId');
    if (fromLS) {
      this.myPeerId = fromLS;
      return fromLS;
    }

    /* (d) persisted in NativeStorage? (sync fallback) */
    if ((window as any).cordova) {
      /* NativeStorage is async, but we can do a *very* small trick:
         read it synchronously from the plugin’s internal cache if present */
      // @ts-ignore
      const cached = this.nativeStorage?._db?.storage?.peerId;
      if (cached) {
        this.myPeerId = cached;
        return cached;
      }
    }

    /* (e) still nothing */
    return null;
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

/**
 * Refresh the list of available media devices
 */
async refreshDevices(): Promise<void> {
  try {
    await navigator.mediaDevices.enumerateDevices();
    // This triggers the devicechange event which will update our device list
  } catch (error) {
    console.error('Error refreshing devices:', error);
  }
}

/**
 * Get the video sender from the current peer connection
 */
private getVideoSender(): RTCRtpSender | null {
  if (!WebrtcService.call || !WebrtcService.call.peerConnection) {
    return null;
  }
  
  const senders = WebrtcService.call.peerConnection.getSenders();
  return senders.find(sender => sender.track?.kind === 'video') || null;
}

/**
 * Get the audio sender from the current peer connection
 */
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
      this.userService.heartbeatPeer(userId)     // new lightweight call
        .catch(err => console.error('❌ heartbeat failed:', err));
    }, 60_000);                                   // every 60 s
  }
  

// webrtc.service.ts  ── just replace the whole method
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
      () => reject(new Error('⏰ peer.open timeout (10 s)')), 10_000
    );
    WebrtcService.peer.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}


  private creatingPeer = false;         // ⇦  guard

  async createPeer(authUserId: string): Promise<void> {
    if (this.creatingPeer) return;      
    if (WebrtcService.peer && WebrtcService.peer.open) return;
    this.creatingPeer = true;
  
    return new Promise((resolve, reject) => {
      const myPeerId  = authUserId;
      this.myPeerId   = myPeerId;
      this.userId     = authUserId;
  
      WebrtcService.peer = new Peer(myPeerId, {
        host   : 'peerjs-whei.onrender.com',
        port   : 443,
        secure : true,
        path   : '/peerjs',
        config : { 
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ] 
        }
      });
  
      WebrtcService.peer.once('open', async () => {
        console.log('✅ peer open');
  
        localStorage.setItem('peerId', myPeerId);
        try { await this.nativeStorage.setItem('peerId', myPeerId); } 
        catch {}
  
        await this.userService.sendPeerIdToBackend(authUserId, myPeerId);
        this.startPeerIdHeartbeat(authUserId, myPeerId);
        this.creatingPeer = false;
        resolve();
      });
  
      WebrtcService.peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          console.warn('♻️ id in use – waiting 3 s then reconnect');
          setTimeout(() => { try { WebrtcService.peer?.reconnect(); } catch {} }, 3000);
          return;
        }
        console.error('peer error:', err);
      });
    });
  }
  
  
  



  
  async getPartnerUser(partnerId: string): Promise<User | null> {
    try {
      const user = await this.userService.getUserProfile(partnerId).toPromise();
      console.log("userService.getUserProfile(userService.getUserProfile(userService.getUserProfile(userService.getUserProfile(", user);

      return user || null; // Return the user object or null if undefined
    } catch (error) {
      console.error("❌ Error fetching partner user:", error);
      return null;
    }
  }

// Add to WebrtcService
private callState = new BehaviorSubject<{connected: boolean, type: 'caller' | 'receiver'}>(null);
public callState$ = this.callState.asObservable();

async callPartner(partnerPeerId: string) {
  console.log(`📞 Attempting to call partner with Peer ID: ${partnerPeerId}`);

  if (!this.myEl || !this.partnerEl) {
    console.error("❌ Cannot call: video elements not initialized");
    return;
  }
  
  if (!this.myStream) {
    console.error("❌ Cannot call: no local media stream");
    return;
  }

  if (!partnerPeerId) {
    console.error("❌ Partner's Peer ID is missing. Cannot call.");
    this.toastService.presentStdToastr("User is offline or unavailable.");
    return;
  }

  WebrtcService.call = WebrtcService.peer.call(partnerPeerId, this.myStream);
  this.callState.next({connected: false, type: 'caller'}); // Set initial state

  if (!WebrtcService.call) {
    console.error("❌ WebRTC Call object is undefined.");
    return;
  }

/* ────────── remote stream + close handling ────────── */
/*  ────────── remote stream + close handling ──────────  */
WebrtcService.call.on('stream', (remote) => {

  const attach = () => {
    if (!this.partnerEl) {
      return setTimeout(attach, 100);          // element not ready yet
    }

    // 1. assign stream
    this.partnerEl.srcObject = remote;

    // 2. once metadata is ready → play()
    const tryPlay = () => {
      const playPromise = this.partnerEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          /* some browsers need another tick */
          setTimeout(tryPlay, 100);
        });
      }
    };

    this.partnerEl.onloadedmetadata = tryPlay;
    tryPlay();                                 // fallback if event already fired

    // 3. update ui state
    this.callState.next({ connected: true, type: 'caller' });
  };

  attach();
});

/* 🔑 unified close / error → reset + broadcast */
const closed = () => {
  this.callState.next(null);
  window.dispatchEvent(new CustomEvent('peer-call-closed'));
};
WebrtcService.call.on('close',  closed);
WebrtcService.call.on('error', closed);


  console.log("✅ Call initiated successfully.");
}

  
async getUserMedia(): Promise<MediaStream | null> {
  this.releaseCurrentStream();

  try {
    // Get available devices with locking
    const videoDeviceId = await this.deviceManager.getAvailableDevice('videoinput', this.tabId);
    const audioDeviceId = await this.deviceManager.getAvailableDevice('audioinput', this.tabId);

    if (!videoDeviceId || !audioDeviceId) {
      throw new Error('All devices are currently in use');
    }

    // Store the acquired device IDs
    this.activeDevices = {
      video: videoDeviceId,
      audio: audioDeviceId
    };

    // Create stream with acquired devices
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: videoDeviceId } },
      audio: { deviceId: { exact: audioDeviceId } }
    });

    this.activeStreams.set(this.tabId, stream);
    return stream;
  } catch (error) {
    console.error('Error acquiring media:', error);
    
    // Fallback strategy
    try {
      console.log('Attempting fallback with relaxed constraints');
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Most relaxed constraints
        audio: true
      });
      this.activeStreams.set(this.tabId, fallbackStream);
      return fallbackStream;
    } catch (fallbackError) {
      console.error('Fallback media acquisition failed:', fallbackError);
      this.toastService.presentStdToastr(
        'All cameras/microphones are in use. ' +
        'Please close other applications using these devices and try again.'
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
      p.catch(() => setTimeout(resume, 100));   // retry if autoplay blocked
    }
  };

  if (el.readyState >= 1) {
    resume();                     // metadata is already available
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
  this.missedCalls$.next(missedCalls);
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

  WebrtcService.peer.on("call", async (call) => {
    console.log("📞 Incoming call detected from:", call.peer);

    try {
      // ✅ Acquire specific devices for this tab
      if (!this.myStream) {
        console.log("🎥 Media stream not ready. Trying to acquire specific devices...");

        // 💡 Replace with your service reference if needed
        this.myStream = await this.getOptimalMediaStream();

        if (!this.myStream) {
          console.error("❌ Cannot answer: No media stream available.");
          return;
        }

        if (this.myEl) {
          this.myEl.srcObject = this.myStream;
        }
      }

      WebrtcService.call = call;
      const partnerId = call.peer.split('-')[0]; // Extract actual user ID
      localStorage.setItem('partnerId', partnerId);

      // ✅ Navigate to video page if not already there
      if (!this.router.url.includes('/messages/video')) {
        console.log("🔁 Navigating to video call screen...");

        const navigationSuccess = await this.router.navigate(
          ['/messages/video', partnerId],
          {
            queryParams: { answer: true },
            state: { incomingCall: true }
          }
        );

        if (!navigationSuccess) {
          console.error("❌ Navigation to video screen failed");
          call.close();
          return;
        }
      }

      // ✅ Answer the call after ensuring media stream is ready
      WebrtcService.call = call;
      localStorage.setItem('partnerId', partnerId);
      
      // ✅ Navigate to video page
      if (!this.router.url.includes('/messages/video')) {
        await this.router.navigate(['/messages/video', partnerId], {
          queryParams: { answer: true },
          state: { incomingCall: true }
        });
      }
      // Setup stream handlers

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
      if (call) call.close();
    }
  });
}




// ✅ Function to check if the peer is online
async checkPeerOnline(peerId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = WebrtcService.peer.connect(peerId);
    conn.on("open", () => {
      console.log(`✅ Peer ${peerId} is online`);
      resolve(true);
      conn.close();
    });
    conn.on("error", () => {
      console.warn(`⚠️ Peer ${peerId} is offline`);
      resolve(false);
    });
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
      this.errorMsg('Permissions have not been granted to use your camera and ' +
        'microphone, you need to allow the page access to your devices in ' +
        'order for the demo to work.');
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

  answer(call?: MediaConnection) {
    if (!this.myStream) {
      console.error("❌ Cannot answer: No media stream available.");
      return;
    }
  
    const activeCall = call || WebrtcService.call;
    if (!activeCall) {
      console.error("❌ No incoming call to answer.");
      return;
    }
  
    console.log("📞 Answering call from:", activeCall.peer);
    activeCall.answer(this.myStream);
    this.callState.next({connected: false, type: 'receiver'});
  
/* ────────── remote stream + close handling ────────── */
// webrtc.service.ts  –– inside answer()
activeCall.on('stream', (remote: MediaStream) => {
  console.log('📡 remote stream', remote);

  /* attach when the first video frame is really flowing */
  const vTrack = remote.getVideoTracks()[0];
  const attach = () => {
    if (!this.partnerEl) {              // video tag not ready yet
      return setTimeout(attach, 100);
    }

    /* 1 — assign */
    this.partnerEl.srcObject = remote;

    /* 2 — autoplay helper */
    const tryPlay = () => {
      const p = this.partnerEl.play();
      if (p !== undefined) {            // Chrome returns a promise
        p.catch(() => setTimeout(tryPlay, 100));
      }
    };
    this.partnerEl.onloadedmetadata = tryPlay;
    tryPlay();

    /* 3 — mark call as connected */
    this.callState.next({ connected: true, type: 'receiver' });
  };

  if (vTrack) {
    /* Firefox & Chrome fire “unmute” when real frames start */
    vTrack.onunmute = () => {
      vTrack.onunmute = null;           // run only once
      attach();
    };
  }

  /* Safari fallback – its “unmute” is unreliable */
  setTimeout(attach, 1500);
});




/* 🔑 unified close / error → reset + broadcast */
const closed = () => {
  this.callState.next(null);
  window.dispatchEvent(new CustomEvent('peer-call-closed'));
};
activeCall.on('close',  closed);
activeCall.on('error', closed);


    WebrtcService.call = activeCall;
  }


  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
  
    console.log("🛑 Closing WebRTC connections and releasing devices...");
    
    // Release device locks
    if (this.activeDevices.video) {
      this.deviceManager.releaseDevice(this.activeDevices.video, this.tabId);
      if (this.deviceLockChannel) {
        this.deviceLockChannel.postMessage({
          type: 'release',
          kind: 'video',
          deviceId: this.activeDevices.video
        });
      }
    }
    
    if (this.activeDevices.audio) {
      this.deviceManager.releaseDevice(this.activeDevices.audio, this.tabId);
      if (this.deviceLockChannel) {
        this.deviceLockChannel.postMessage({
          type: 'release',
          kind: 'audio', 
          deviceId: this.activeDevices.audio
        });
      }
    }
  
    // Clean up peer connection
    if (WebrtcService.call) {
      try {
        WebrtcService.call.close();
      } catch (err) {
        console.error("Error closing call:", err);
      }
      WebrtcService.call = null;
    }
  
    // Clean up media streams
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => track.stop());
      this.myStream = null;
    }
  
    // Clean up video elements
    if (this.myEl) {
      this.myEl.srcObject = null;
    }
    if (this.partnerEl) {
      this.partnerEl.srcObject = null;
    }
  
    // Reset state
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