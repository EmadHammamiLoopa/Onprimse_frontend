import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Platform } from '@ionic/angular';
import { Injectable } from '@angular/core';
import Peer, { MediaConnection, PeerJSOption } from 'peerjs';
import { PermissionService } from './permission.service';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserService } from './user.service';
import { ToastService } from './toast.service';
import { User } from '../models/User';
import { SocketService } from './socket.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';


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
  myEl: HTMLMediaElement;
  partnerEl: HTMLMediaElement;
  user: User = new User(); // ✅ Added `user` property here
  private peerHeartbeatInterval: any;
  private missedCalls = new BehaviorSubject<MissedCall[]>([]);
  public missedCalls$ = this.missedCalls.asObservable();
  
  
  private isClosed = false;

  userId: string;
myPeerId: string;

  stun = 'stun.l.google.com:19302';
  mediaConnection: MediaConnection;
  options: PeerJSOption;
  stunServer: RTCIceServer = {
    urls: 'stun:' + this.stun,
  };
  static call;
  facingMode = "user";

  
  constructor(private androidPermission: AndroidPermissions, private permissionService: PermissionService, 
              private router: Router,private nativeStorage: NativeStorage,private socketService: SocketService,   private userService: UserService,private toastService: ToastService          ) {
    this.options = {
      key: 'cd1ft79ro8g833di',
      debug: 3
    };
    this.loadMissedCallsFromStorage();
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

  async init(myEl: HTMLMediaElement, partnerEl: HTMLMediaElement): Promise<boolean> {
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
WebrtcService.call.on('stream', stream => {
  const attach = () => {
    if (this.partnerEl) {
      this.partnerEl.srcObject = stream;
      this.callState.next({ connected: true, type: 'caller' });
    } else {
      setTimeout(attach, 100);
    }
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
  try {
    console.log("🎥 Requesting user media...");

    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(device => device.kind === "videoinput");
    const hasMic = devices.some(device => device.kind === "audioinput");

    if (!hasCamera) {
      console.warn("⚠️ No camera detected.");
      return null;
    }
    if (!hasMic) {
      console.warn("⚠️ No microphone detected.");
      return null;
    }

    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });
    console.log("🎙️ Audio tracks:", stream.getAudioTracks());
    console.log("📹 Video tracks:", stream.getVideoTracks());
    this.handleSuccess(stream);
    console.log("✅ Media stream initialized successfully.");
    return stream;
  } catch (error) {
    this.handleError(error);
    console.error("❌ Error getting user media:", error);
    return null;
  }
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
  this.missedCalls.next(missedCalls);
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
      // 👉 Ensure media stream is ready before answering
      if (!this.myStream) {
        console.log("🎥 Media stream not ready. Attempting to getUserMedia...");
        this.myStream = await this.getUserMedia();

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

      // ✅ Use Angular Router for navigation instead of window.location
      if (!this.router.url.includes('/messages/video')) {
        console.log("🔁 Navigating to video call screen...");
        
        // Store the call reference before navigation
        const navigationSuccess = await this.router.navigate(
          ['/messages/video', partnerId], 
          { 
            queryParams: { answer: true },
            state: { incomingCall: true } // Optional: pass state data
          }
        );

        if (!navigationSuccess) {
          console.error("❌ Navigation to video screen failed");
          call.close();
          return;
        }
      }

      // Setup stream handlers
      call.on("stream", (remoteStream) => {
        console.log("✅ Remote stream received in wait().");
        
        // Check if we're on the video page before assigning stream
        if (this.router.url.includes('/messages/video') && this.partnerEl) {
          console.log("🎥 partnerEl is defined in wait(), assigning stream.");
          this.partnerEl.srcObject = remoteStream;
        } else {
          console.warn("⚠️ Not on video page or partnerEl not available");
        }
      });

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
activeCall.on('stream', remote => {
  const attach = () => {
    if (this.partnerEl) {
      this.partnerEl.srcObject = remote;
      this.callState.next({ connected: true, type: 'receiver' });
    } else {
      setTimeout(attach, 100);
    }
  };
  attach();
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
    if (this.isClosed) {
      console.log("⚠️ WebRTC already closed. Skipping...");
      return;
    }
    this.isClosed = true;
  
    console.log("🛑 Closing WebRTC connections...");
    
    if (WebrtcService.call) {
      try {
        WebrtcService.call.close();
        console.log("✅ WebRTC call closed successfully.");
      } catch (err) {
        console.error("❌ Error closing call:", err);
      }
      WebrtcService.call = null;
    }
  
    if (!this.callState.value?.connected) {
      console.warn("⚠️ Missed call detected during close() - storing missed call");
      this.registerMissedCall(this.userId);
    }
  
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => track.stop());
      this.myStream = null;
    }
  
    if (this.myEl) {
      this.myEl.srcObject = null;
      this.myEl = null;    // 🔑 important
    }
    if (this.partnerEl) {
      this.partnerEl.srcObject = null;
      this.partnerEl = null;
    }
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