import { Location } from '@angular/common';
import { ToastService } from './../../../../services/toast.service';
import { UserService } from './../../../../services/user.service';
import { User } from './../../../../models/User';
import { WebrtcService } from './../../../../services/webrtc.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { SocketService } from 'src/app/services/socket.service';
import { MessengerService } from './../../../messenger.service';
import { AdMobFeeService } from './../../../../services/admobfree.service';
import { Socket } from 'socket.io-client';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Subscription } from 'rxjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss'],
})
export class VideoComponent implements OnInit, OnDestroy {
  calling = false;
  isAudioPlaying = false; // Add this flag

  pageLoading = false;
  topVideoFrame = 'partner-video';
  authUser: User; // ✅ The logged-in user
  partnerUser: User; // ✅ The recipient user (partner in the call)
  userId: string; // ID of the recipient
  myEl: HTMLVideoElement;
  partnerEl: HTMLVideoElement;
  
  partner: User = new User();
  user: User = new User();
  answer = false;
  answered = false;
  socket: Socket | null = null; // Use the Socket type from socket.io-client
  audio: HTMLAudioElement;
  audioEnabled = true;
  cameraEnabled = true;
  localStream: MediaStream | null = null;
  jwtHelper = new JwtHelperService();
  callDuration = 0; // Initialize at 0 seconds
  private callTimer: any; // For storing the timer reference
  partnerName: string;

  answeringCall = false;
startingCall = false;
endingCall = false;
switchingCamera = false;

// Add to your component
@ViewChild('myVideo', { static: false }) myVideoRef: ElementRef;
@ViewChild('partnerVideo', { static: false }) partnerVideoRef: ElementRef;
  private callStateSubscription: Subscription;
  private connectionSubscriptions: Subscription[] = [];

  private partnerAnsweredListener: () => void;
  private backButtonSubscription: Subscription;
  
  constructor(
    public webRTC: WebrtcService,
    public elRef: ElementRef,
    private route: ActivatedRoute,
    private userService: UserService,
    private toastService: ToastService,
    private location: Location,
    private nativeStorage: NativeStorage,
    private router: Router,
    private messengerService: MessengerService,
    private adMobFeeService: AdMobFeeService,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef,
    private platform: Platform
    
  ) {    this.partnerAnsweredListener = () => {
    console.log("🎉 Partner has answered the call (class handler)");
    this.answered = true;
    this.cdr.detectChanges();
  };
}



  ngOnInit() {
    console.log('📞 Initializing Video Call Component...');
    
    // Subscribe to call state changes
    this.callStateSubscription = this.webRTC.callState$.subscribe(state => {
      if (state?.connected) {
        console.log("🎉 Call connected - updating UI");
        this.answered = true;
        this.calling = false;
        this.startCallTimer();
        this.cdr.detectChanges();
      } else if (state === null) {
        this.stopCallTimer();
      }
    });

    // Set up back button handler
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });

    // First get the auth user
    this.getAuthUser().then(() => {
      // Then get the route parameters
      this.route.paramMap.subscribe(params => {
        this.userId = params.get('id');
        console.log("🟢 Retrieved Partner User ID:", this.userId);
  
        if (!this.userId) {
          console.error("❌ No partner ID provided in route");
          this.router.navigate(['/']); // Redirect if no ID
          return;
        }
  
        // Get user profile
        this.getUser();
  

      window.removeEventListener("partner-answered", this.partnerAnsweredListener); // ✅ Fixed

  
        // Clean up listener when component is destroyed
        this.connectionSubscriptions.push(new Subscription(() => {
          window.addEventListener("partner-answered", this.partnerAnsweredListener);
        }));
  
        window.addEventListener('peer-call-error', () => {
          this.toastService.presentStdToastr('Call could not be established');
          this.cancel(true);               // silent local cleanup
        });
        
        // Get query params
        this.route.queryParamMap.subscribe(query => {
          this.answer = query.get('answer') === 'true';
          console.log("🟢 Answer Mode:", this.answer);
          
          // For callers only - wait for video elements will be handled in ionViewWillEnter
          if (!this.answer) {
            console.log("🔄 Caller mode - call will be initiated after view enters");
          }
        });
      });
    });
  }
  private handleBackButton() {
    console.log('🔙 Handling back button');
    this.cleanupResources();
    this.location.back();
  }

// Remove ionViewDidLeave and keep ionViewWillLeave
ionViewWillLeave() {
  console.log('🏁 VideoComponent will leave');
  this.cleanupResources();
}

  ngOnDestroy() {
    console.log('🧹 VideoComponent destroyed');
    this.cleanupResources();
    
    // Clean up subscriptions
    if (this.callStateSubscription) {
      this.callStateSubscription.unsubscribe();
    }
    
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
    
    this.connectionSubscriptions.forEach(sub => sub.unsubscribe());
    this.connectionSubscriptions = [];
  }

  private cleanupResources() {
    console.log('🧹 Cleaning up resources');
    
    // 1. Remove event listeners
    window.removeEventListener("partner-answered", this.partnerAnsweredListener);
    
    // 2. Clean up audio
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    
    // 3. Clean up WebRTC
    this.webRTC.close();
    
    // 4. Clean up video elements
    if (this.myEl) {
      this.myEl.srcObject = null;
      this.myEl.pause();
    }
    if (this.partnerEl) {
      this.partnerEl.srcObject = null;
      this.partnerEl.pause();
    }
    
    // 5. Clean up socket
    if (this.socket) {
      this.socket.emit('disconnect-user');
      this.socket.disconnect();
      this.socket = null;
    }
  }


// Add these methods to your component
private startCallTimer() {
  this.callDuration = 0; // Reset when call starts
  this.callTimer = setInterval(() => {
    this.callDuration++;
    this.cdr.detectChanges(); // Update the view
  }, 1000); // Increment every second
}

private stopCallTimer() {
  if (this.callTimer) {
    clearInterval(this.callTimer);
    this.callTimer = null;
  }
}
async ionViewWillEnter() {
  try {
    this.pageLoading = true; this.cdr.detectChanges();

    await this.webRTC.createPeer(this.authUser._id); // only once

    await this.waitForVideoElements();
    if (!await this.checkMediaPermissions()) throw new Error('perm');

    await this.webRTC.init(this.myEl, this.partnerEl);

    if (!this.answer) {
      console.log('🔄 caller mode');
      await this.initializeCallWithRetry();
    }
  } catch (e) {
    console.error(e);
    this.toastService.presentStdToastr('Failed to start video call.');
    this.router.navigate(['/']);
  } finally {
    this.pageLoading = false; this.cdr.detectChanges();
  }
}



private async initializeCallWithRetry(retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      this.startingCall = true;
      await this.call();
      return true;
    } catch (error) {
      console.warn(`Call attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    } finally {
      this.startingCall = false;
    }
  }
  throw new Error(`Failed to initialize call after ${retries} attempts`);
}

private async checkMediaPermissions(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error("Permission denied:", err);
    this.toastService.presentStdToastr("Please enable camera and microphone permissions");
    return false;
  }
}

private async waitForVideoElements(): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30; // Increased further
    let attempts = 0;
    
    const checkElements = () => {
      attempts++;
      
      // Use both ViewChild and direct DOM query with fallbacks
      this.myEl = this.myVideoRef?.nativeElement || 
                 document.querySelector('#my-video') as HTMLVideoElement;
      this.partnerEl = this.partnerVideoRef?.nativeElement || 
                      document.querySelector('#partner-video') as HTMLVideoElement;
      
      if (this.myEl && this.partnerEl) {
        console.log('✅ Video elements found after', attempts, 'attempts');
        resolve();
      } else if (attempts >= maxAttempts) {
        console.error('Video elements not found:', {
          myVideoRef: !!this.myVideoRef,
          partnerVideoRef: !!this.partnerVideoRef,
          myVideoDOM: !!document.querySelector('#my-video'),
          partnerVideoDOM: !!document.querySelector('#partner-video')
        });
        reject(new Error(`Video elements not found after ${maxAttempts} attempts`));
      } else {
        setTimeout(checkElements, 150); // Slightly longer delay
      }
    };
    
    // Initial check after a brief delay to allow rendering
    setTimeout(checkElements, 100);
  });
}

handleVideoError(type: 'local' | 'partner') {
  console.error(`${type} video error`);
  this.toastService.presentStdToastr(`${type} video failed to load`);
}
getUserId() {
  this.route.paramMap.subscribe((params) => {
      this.userId = params.get('id');
      console.log("🟢 Retrieved Parternrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr User ID:", this.userId);
      
      this.route.queryParamMap.subscribe((query) => {
          this.answer = query.get('answer') ? true : false;
          console.log("🟢 Answer Mode:", this.answer);
          
          this.getUser();
      });
  });
}


getUser() {
  console.log('Fetching partner profile for ID:', this.userId);
  this.userService.getUserProfile(this.userId).subscribe(
    async (resp: any) => {
      this.pageLoading = false;
      console.log('Partner profile response:', resp);

      const userData = resp.data || resp;

      if (userData) {
        try {
          console.log('Raw userData:', userData);
          this.partner = userData instanceof User ? userData : new User().initialize(userData);
          console.log('Partner initialized successfully:', this.partner);
        } catch (error) {
          console.error('Error initializing partner user:', error);
          this.handleUserInitError();
        }
      } else {
        console.error('Invalid response data: userData is null or undefined');
        this.handleUserInitError();
      }
    },
    (err) => {
      console.error('Error fetching partner profile:', err);
      this.pageLoading = false;
      this.location.back();
      this.toastService.presentStdToastr('Cannot make this call, try again later');
    }
  );
}


  async getAuthUser(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🔍 Starting authentication process...');
  
  const getToken = async (): Promise<string | null> => {
    console.log('🔑 Attempting to retrieve token...');
    if (this.isCordovaAvailable()) {
      console.log('📱 Cordova platform detected - using NativeStorage');
      try {
        const token = await this.nativeStorage.getItem('token');
        console.log('✅ Token retrieved from NativeStorage');
        return token;
      } catch (err) {
        console.warn("⚠️ Failed to retrieve token from NativeStorage:", err);
        return null;
      }
    } else {
      console.log('🖥️ Web platform detected - using localStorage');
      const token = localStorage.getItem('token');
      console.log(token ? '✅ Token retrieved from localStorage' : '❌ No token in localStorage');
      return token;
    }
  };

  getToken().then((token) => {
    if (!token) {
      console.error("❌ No token found in storage");
      this.router.navigate(['/auth/signin']);
      return;
    }

    console.log('🔍 Token found, decoding...');
    try {
      const decoded = this.jwtHelper.decodeToken(token);
      console.log('🔍 Decoded token content:', {
        idPresent: !!decoded?._id,
        firstNamePresent: !!decoded?.firstName,
        lastNamePresent: !!decoded?.lastName,
        avatarPresent: !!decoded?.mainAvatar
      });

      if (!decoded?._id) {
        console.error("❌ Invalid token structure - missing _id");
        this.router.navigate(['/auth/signin']);
        return;
      }

      // ONLY use the decoded token data
      this.authUser = new User().initialize({
        _id: decoded._id,
        firstName: decoded.firstName || '',
        lastName: decoded.lastName || '',
        mainAvatar: decoded.mainAvatar || ''
      });
      
          console.log("🔐 Auth user initialized:", this.authUser._id);
          resolve();
        } catch (error) {
          console.error("❌ Token decoding failed:", error);
          this.router.navigate(['/auth/signin']);
        }
      });
    });
  }


  handleUserInitError() {
    this.pageLoading = false;
    this.toastService.presentStdToastr('User not found, please log in again');
    this.router.navigate(['/auth/signin']);
  }

  pauseAudio() {
    if (this.audio && this.isAudioPlaying) {
      this.audio.pause();
      this.isAudioPlaying = false;
    }
  }

  async initializeSocket(userId: string) {
    try {
        if (this.socket) {
            console.warn("⚠️ WebSocket already initialized. Checking connection...");
            if (this.socket.connected) {
                console.log("✅ WebSocket is already connected.");
                return;
            } else {
                console.warn("🔄 WebSocket was disconnected. Attempting to reconnect...");
                this.socket.disconnect(); // Ensure cleanup before reconnecting
            }
        }

        console.log("🔵 Initializing WebSocket for userId:", userId);
        await SocketService.initializeSocket();

        // ✅ Retry WebSocket retrieval to ensure it's available
        let attempts = 0;
        while (!this.socket && attempts < 3) {
            this.socket = await SocketService.getSocket();
            if (!this.socket) {
                console.warn(`⚠️ WebSocket still not available. Retrying (${attempts + 1}/3)...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec before retrying
            }
            attempts++;
        }

        if (!this.socket) {
            console.error("❌ WebSocket initialization failed after multiple attempts.");
            return;
        }

        console.log("✅ WebSocket instance retrieved:", this.socket.id);
        this.listenForVideoCallEvents(); // Ensure event listeners are set up

    } catch (error) {
        console.error("❌ WebSocket initialization failed:", error);
    }
}

  
listenForVideoCallEvents() {
  if (!this.socket) {
      console.error("❌ WebSocket not initialized. Cannot listen for video call events.");
      return;
  }

  // Prevent multiple listeners
  this.socket.off('video-call-started');
  this.socket.off('video-canceled');
  this.socket.off('video-call-ended');
  this.socket.off('video-call-failed');

  this.socket.on('video-call-started', (data) => {
      console.log("📞 Video call started:", data);
      this.playAudio('/assets/audio/calling.mp3');
      if (this.answer) { // If user is answering a call
        this.answerCall();
    }
  });

  this.socket.on('video-canceled', () => {
      console.log("🚫 Video call canceled by other user.");
      this.pauseAudio();
      this.cancel(); // Close call UI
  });

  this.socket.on('video-call-ended', () => {
      console.log("📴 Video call ended.");
      this.pauseAudio();
      this.closeCall(); // Ensure call is properly closed
    });

  this.socket.on('video-call-failed', (error) => {
      console.error("❌ Video call error:", error);
      this.toastService.presentStdToastr("Call failed. Please try again.");
      this.cancel();
  });

  // ✅ Handle unexpected disconnections
  this.socket.on("disconnect", () => {
      console.warn("⚠️ WebSocket disconnected. Attempting auto-reconnect...");
      setTimeout(() => this.initializeSocket(this.userId), 2000);
  });
}

  

playAudio(src: string) {
  if (!this.audio) {
      this.audio = new Audio();
  }

  if (this.audio.src !== src) {
      this.audio.src = src;
      this.audio.load();
  }

  this.audio.loop = true;

  this.audio.oncanplaythrough = () => {
      this.audio.play()
          .then(() => {
              this.isAudioPlaying = true;
              console.log("🎵 Playing audio:", src);
          })
          .catch(error => {
              console.error('❌ Audio play error:', error);
              console.warn("⚠️ Some browsers block autoplay. Ensure user interaction occurs first.");
          });
  };
}



  async init(myVideoEl: HTMLVideoElement, partnerVideoEl: HTMLVideoElement): Promise<void> {
    try {
        // ✅ Request user media (camera + mic)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!stream) {
            throw new Error("❌ Failed to get media stream.");
        }

        // ✅ Assign local stream to video element
        myVideoEl.srcObject = stream;

        // ✅ Store the stream for later use
        this.localStream = stream;

        console.log("✅ Local video stream initialized.");

    } catch (err) {
        console.error("❌ Error initializing video:", err);
    }
}

async emitWebSocketEvent(eventName: string, data: any) {
  if (!this.socket) {
      console.warn("⚠️ WebSocket is not ready. Trying to retrieve...");
      this.socket = await SocketService.getSocket();

      if (!this.socket) {
          console.error("❌ WebSocket is still not available. Aborting event emit.");
          return;
      }
  }

  if (!this.socket.connected) {
      console.warn("⚠️ WebSocket is disconnected. Attempting to reconnect...");
      await this.initializeSocket(this.userId);
  }

  console.log(`📤 Emitting event: ${eventName}`, data);
  this.socket.emit(eventName, data);
  
}

/**
 * Call the other user.
 * Preconditions:
 *   – this.authUser      is already populated   (ngOnInit → getAuthUser)
 *   – this.userId        holds partner’s user-id (route param)
 *   – webRTC.createPeer(authUser._id) was called once after login
 */
/* ───────────────────────── video.component.ts ───────────────────────── */
async call(): Promise<void> {
  console.log('📞 Initiating video call…');

  /* 0 — sanity -------------------------------------------------------- */
  if (!this.authUser?._id || !this.userId) {
    console.error('❌ Missing authUser._id or partner userId');
    return;
  }

  try {
    /* 1 — make sure the <video> elements exist ------------------------ */
    if (!this.myEl || !this.partnerEl) {
      await this.waitForVideoElements();
    }
    if (!this.localStream) {
      await this.init(this.myEl, this.partnerEl);
    }
    /* 2 — guarantee a live & open PeerJS instance --------------------- */
    if (!WebrtcService.peer || WebrtcService.peer.destroyed) {
      const myPeerId = await this.userService.getPartnerPeerId(this.authUser._id).toPromise();
      await this.webRTC.createPeer(myPeerId);
      
    }

    /* NEW ▸ if peer is still null create it once more (rare) */
    if (!WebrtcService.peer) {
      await this.webRTC.createPeer(this.authUser._id);
    }

    /* NEW ▸ wait for the “open” event, retry once on failure */
    let opened = false;
    for (let i = 0; i < 2 && !opened; i++) {
      try {
        await this.webRTC.waitForPeerOpen();   // throws if peer == null
        opened = true;
      } catch (e) {
        console.warn(`⏳ peer.open attempt ${i + 1} failed:`, e.message);
        await this.webRTC.createPeer(this.authUser._id);     // same id
      }
    }
    if (!opened) throw new Error('PeerJS could not be opened');

    const myPeerId = this.webRTC.getPeerId();
    if (!myPeerId) throw new Error('Peer-ID still missing after open()');

    /* 3 — lookup partner’s current peer-id ---------------------------- */
    const partnerPeerId =
    await this.userService.getPartnerPeerId(this.userId).toPromise();
  
  if (!partnerPeerId) {
    throw new Error('Partner is offline or has no peer-id');
  }
  
  /* NEW 3b — ping the peer before dialling --------------------------- */
  const online = await this.webRTC.checkPeerOnline(partnerPeerId);
  if (!online) {
    this.toastService.presentStdToastr('User is offline at the moment.');
    return;                                   // abort call here
  }
  if (!online) {                    // already shows toast
    window.dispatchEvent(new CustomEvent('peer-call-error'));
    return;
  }
  
    /* 4 — dial -------------------------------------------------------- */
    console.log(`📞 Calling partner – myId=${myPeerId} → partnerId=${partnerPeerId}`);
    await this.webRTC.callPartner(partnerPeerId);
    this.calling = true;

    /* 5 — notify via socket ------------------------------------------ */
    await this.emitWebSocketEvent('video-call-started', {
      from        : this.authUser._id,
      to          : this.userId,
      myPeerId,
      partnerPeerId
    });

  } catch (err) {
    console.error('❌ Call failed:', err);
    this.toastService.presentStdToastr('Call failed. Please try again.');
    this.closeCall();
  }
}






  waitForAnswer() {
    const timer = setInterval(() => {
      if (this.partnerEl && this.partnerEl.srcObject) {
        this.pauseAudio();
        this.messengerService.sendMessage({ event: 'stop-audio' });
        this.answered = true;
        this.cdr.detectChanges(); // ✅ Force update
        this.countVideoCalls();
        this.swapVideo('my-video');
        clearInterval(timer);
      }
    }, 10);
  }

  getVideoCalls() {
    return this.nativeStorage.getItem('videoCalls').then(
      (calls) => {
        return calls;
      },
      (err) => {
        return [];
      }
    );
  }

  countVideoCalls() {
    this.getVideoCalls().then((calls) => {
        calls = Array.isArray(calls) ? calls : []; // ✅ Ensure it's an array
        calls = calls.filter((call) => new Date().getTime() - call.date < 24 * 60 * 60 * 1000);
        
        calls.push({
          id: this.authUser._id, // Changed from this.user.id
          date: new Date().getTime(),
        });

        this.nativeStorage.setItem('videoCalls', calls);
    });
}


  swapVideo(topVideo: string) {
    this.topVideoFrame = topVideo;
  }

  cancelListener() {
    if (this.socket) {
      this.socket.on('video-canceled', () => {
        if (this.audio) this.audio.muted = false;
        this.messengerService.sendMessage({ event: 'stop-audio' });
        this.playAudio('/assets/audio/call-canceled.mp3');
        setTimeout(() => {
          this.cancel(); // Removed manualClose to prevent automatic call closing
        }, 2000);
      });
    }
  }

  async closeCall() {
    console.log("📴 Closing the call with full cleanup...");
    
    // 1. Stop all media streams
    if (this.webRTC.myStream) {
      this.webRTC.myStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
  
    // 2. Clear video elements
    if (this.myEl) {
      this.myEl.srcObject = null;
      this.myEl.pause();
    }
    if (this.partnerEl) {
      this.partnerEl.srcObject = null;
      this.partnerEl.pause();
    }
  
    // 3. Close WebRTC connection
    this.webRTC.close();
  
    // 4. Notify the other user
    if (this.socket) {
      this.emitWebSocketEvent('video-call-ended', {
        from: this.authUser._id,
        to: this.userId
      });
    }
  
    // 5. Navigate away
    setTimeout(() => {
      this.router.navigate(['/tabs/messages/list']);
    }, 500);
  }



  cancel(manualClose = false) {
    console.log("❌ Cancelling call...");

    this.pauseAudio();
    this.messengerService.sendMessage({ event: 'stop-audio' });

    // ✅ Ensure WebRTC stream is stopped and video elements are reset
    this.webRTC.close(); // ✅ centralized cleanup


    // ✅ Reset video elements
    if (this.myEl) {
        this.myEl.srcObject = null;
    }
    if (this.partnerEl) {
        this.partnerEl.srcObject = null;
    }

    // ✅ Ensure WebSocket is disconnected
    if (this.socket) {
        console.log("✅ Disconnecting from WebSocket...");
        this.emitWebSocketEvent('video-call-ended', { from: this.authUser._id, to: this.userId });
        this.socket.disconnect();
        this.socket = null;
    }

    if (!this.answered) {
  this.webRTC.registerMissedCall(this.userId);
    }
    

    if (manualClose) {
        console.log("✅ Manual call closure.");
        return;
    }

    console.log("🔄 Navigating back to previous page...");
    this.router.navigate(['/tabs/messages/list']);
}


  

answerCall() {
  this.pauseAudio();
  this.messengerService.sendMessage({ event: 'stop-audio' });

  const waitForCall = (retries = 5) => {
    if (WebrtcService.call) {
      console.log("📞 Answering call from:", WebrtcService.call.peer);
      this.webRTC.answer(WebrtcService.call);
      this.countVideoCalls();
      this.waitForAnswer();
      LocalNotifications.cancel({ notifications: [{ id: 1 }] });

    } else if (retries > 0) {
      console.warn("⏳ Waiting for WebrtcService.call to be set...");
      setTimeout(() => waitForCall(retries - 1), 500);
    } else {
      console.error("❌ Still no call available to answer.");
    }
  };

  waitForCall();
}



  toggleAudio() {
    if (!this.webRTC.myStream) {
      console.error("❌ Cannot toggle audio: Media stream is not initialized.");
      return;
    }
    this.audioEnabled = this.webRTC.toggleAudio();
  }
  
  toggleCamera() {
    if (!this.webRTC.myStream) {
      console.error("❌ Cannot toggle camera: Media stream is not initialized.");
      return;
    }
    this.cameraEnabled = this.webRTC.toggleCamera();
  }
  

  toggleCameraDirection() {
    this.webRTC.toggleCameraDirection();
  }


  
  isCordovaAvailable(): boolean {
    return !!(window.cordova && window.cordova.platformId !== 'browser');
  }
}