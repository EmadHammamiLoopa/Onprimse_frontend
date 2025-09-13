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
import { MediaConnection } from 'peerjs';
import { NgZone } from '@angular/core';
import { RingerService } from 'src/app/services/ringer.service';
import { VideoEvents } from './events';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss'],
})
export class VideoComponent implements OnInit, OnDestroy {
  calling = false;
  @ViewChild('partnerVideo', { static: false })
  private partnerVideoRef!: ElementRef<HTMLVideoElement>;
  pageLoading = false;
  topVideoFrame = 'partner-video';
  authUser: User; // ✅ The logged-in user
  partnerUser: User; // ✅ The recipient user (partner in the call)
  myEl: HTMLVideoElement;
  partnerEl: HTMLVideoElement;
  public partnerId?: string;
  public userId?: string;
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
  private callTimer: any; // For storing the timer reference
  partnerName: string;
  placingCall = false;
  private hangupHandled = false; 
  answeringCall = false;
endingCall = false;
switchingCamera = false;
callTimeout: any = null;
private tearingDown = false;
private hasAnswered = false;

callDuration: string = '00:00';
private callStartTime: number | null = null;
private callTimerInterval: any;
private unansweredTimeout: any;

// Add to your component
@ViewChild('myVideo',      { static: false }) myVideoRef:      ElementRef<HTMLVideoElement>;
  private callStateSubscription: Subscription;
  private connectionSubscriptions: Subscription[] = [];

  private partnerAnsweredListener: () => void;
  private backButtonSubscription: Subscription;
  private isRemoteEnd: boolean = false;

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
    private platform: Platform,
    private ngZone: NgZone,
    private ringer: RingerService

    
  ) {    this.partnerAnsweredListener = () => {
    console.log("🎉 Partner has answered the call (class handler)");
    this.answered = true;
    this.cdr.detectChanges();
  };
}

ngAfterViewInit() {
  if (this.myVideoRef && this.partnerVideoRef) {
    this.webRTC.setVideoElements(this.myVideoRef.nativeElement,
                                 this.partnerVideoRef.nativeElement);
  }

  // run again when change-detection adds the videos
  this.cdr.detectChanges();
}


/* ─── and always deregister on leave/destroy —───────────────────────────── */
ionViewWillLeave() { this.webRTC.clearVideoElements(); }
ngOnDestroy() {
  this.webRTC.clearVideoElements();
  this.callStateSubscription?.unsubscribe();
  this.backButtonSubscription?.unsubscribe();
  this.connectionSubscriptions.forEach(s => s?.unsubscribe());
  this.connectionSubscriptions = [];
  window.removeEventListener('partner-answered', this.partnerAnsweredListener);
}


async ngOnInit() {
  /* ── 1 ▸ diagnostics & device list ──────────────────────────────── */
  console.log('📞 Initializing Video Call Component…');
  this.webRTC.listAllMediaDevices();

  /* ── 2 ▸ react to call-state changes (connected / ended) ─────────── */
  this.callStateSubscription = this.webRTC.callState$
    .subscribe(state => {
      if (state?.connected) {
        this.answered = true;
        this.calling  = false;
        this.startCallTimer();
        this.ringer.stop();
        this.clearUnansweredTimeout();
      } else if (state === null) {
        this.stopCallTimer();
        this.answered = false;
        this.ringer.stop();
      }
      this.cdr.detectChanges();
    });

  /* ── 3 ▸ Android hardware-back button ────────────────────────────── */
  this.backButtonSubscription = this.platform.backButton
    .subscribeWithPriority(10, () => this.handleBackButton());

  /* ── 4 ▸ authentication → socket → route params ─────────────────── */
  try {
    await this.getAuthUser();                               // fills this.authUser
    await this.initializeSocket(this.authUser._id);         // sets up listeners

    this.route.paramMap.subscribe(params => {
      this.userId = params.get('id');
      if (!this.userId) {
        console.error('❌ No partner ID in route');
        return void this.router.navigate(['/']);
      }

      /* partner profile, misc one-off listeners … */
      this.getUser();

      window.addEventListener('partner-answered', this.partnerAnsweredListener, { once:false });
      window.addEventListener('peer-call-error', () => {
        this.toastService.presentStdToastr('Call could not be established');
        this.cancel(true);
      });

      /* caller / callee mode */
      this.route.queryParamMap.subscribe(qp => {
        this.answer = qp.get('answer') === 'true';
        if (!this.answer) {
          console.log('🔄 Caller mode — call will start on view enter');
        } else {
          this.startUnansweredTimeout();    // ring-in side
        }
      });
    });

  } catch (err) {
    console.error('❌ ngOnInit() aborting:', err);
    this.router.navigate(['/auth/signin']);
  }
}


private handleBackButton() {
  console.log('🔙 Handling back button');
  if (this.answer && !this.answered && this.userId) {
    this.webRTC.registerMissedCall(this.userId).catch(()=>{});
    console.log('[missed] back-button fallback');
  }
  
  this.clearUnansweredTimeout();
  this.stopCallTimer();
  this.ringer.stop();
  this.webRTC.close({ silent: true });
  this.router.navigate(['/tabs/messages/list'], { replaceUrl: true }); // ← key line
}


// Remove ionViewDidLeave and keep ionViewWillLeave
// In your video component

private showSelfPreview(stream: MediaStream): void {
  const el = this.myVideoRef.nativeElement;

  if (!el.srcObject)  { el.srcObject = stream; }
  el.muted = true;                           // autoplay allow-list

  const playNow = () => el.play().catch(() => {});
  if (el.readyState >= 1)           { playNow(); }      // metadata present
  else                              { el.onloadedmetadata = playNow; }
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
    this.leaveCallRoom();            // 👈 NEW (optional here)

  }




// Add these methods to your component
startCallTimer() {
  this.callStartTime = Date.now();

  this.callTimerInterval = setInterval(() => {
    if (!this.callStartTime) return;

    const elapsedMs = Date.now() - this.callStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    this.callDuration = `${minutes}:${seconds}`;
  }, 1000); // update every second
}

startMissedCallTimeout() {
  this.callTimeout = setTimeout(() => {
    if (!this.answered) {
      console.log('⏰ No answer in 30 sec — cancelling call');
      this.cancel(false, 'timeout');   // ⬅ reason
    }
  }, 30000);
}

stopCallTimer() {
  clearInterval(this.callTimerInterval);
  this.callTimerInterval = null;
  this.callStartTime = null;
  this.callDuration = '00:00';
}

// video.component.ts
async ionViewWillEnter() {
  try {
    this.pageLoading = true;
    this.cdr.detectChanges();

    await this.waitForVideoElements();
    // Always wire elements so incoming remote stream can attach later
    this.webRTC.setVideoElements(this.myEl, this.partnerEl);

    if (this.answer) {
      // Incoming side: DO NOT open camera yet
      this.ringer.start('ringing.mp3');
      // keep your startUnansweredTimeout() from ngOnInit or call here
    } else {
      // Outgoing side: we can open camera
      const ok = await this.webRTC.init(this.myEl, this.partnerEl);
      if (!ok) throw new Error('Media init failed');
      await this.placeCall();
      this.startMissedCallTimeout();
    }
  } catch (e) {
    console.error(e);
    this.toastService.presentStdToastr('Failed to start video call.');
    this.router.navigate(['/']);
  } finally {
    this.pageLoading = false;
    this.cdr.detectChanges();
  }
}






// video.component.ts  (somewhere near other helpers)
private wireHangup(mc: MediaConnection) {
  mc.once('close', () => {
    // Prevent re-entry if we fired the close ourselves
    if (this.hangupHandled) return;
    this.hangupHandled = true;
    this.ngZone.run(() => this.closeCall());   // run inside Angular
  });
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
        await this.webRTC.bindMissedCallSocketHandlers();

        this.listenForVideoCallEvents(); // Ensure event listeners are set up

    } catch (error) {
        console.error("❌ WebSocket initialization failed:", error);
    }
}

  
// video.component.ts
private idOf = (x: any) => (x && typeof x === 'object') ? (x._id || x.id) : x;

listenForVideoCallEvents() {
  if (!this.socket) return;

  this.socket.off('video-call-started');
  this.socket.off('video-canceled');
  this.socket.off(VideoEvents.CANCELED);
  this.socket.off(VideoEvents.TIMEOUT);
  this.socket.off(VideoEvents.MISSED);
  this.socket.off('cancel-video');              // ⬅ add this off

  this.socket.off('video-call-cancelled');
  this.socket.off(VideoEvents.ENDED);
  this.socket.off(VideoEvents.FAILED);

  this.socket.on('video-call-started', () => this.ringer.start('calling.mp3'));

  const onCanceled = async (ev?: any) => {
    const from = ev?.from ?? ev?.callerId ?? this.userId;
    const to   = ev?.to   ?? ev?.calleeId;
  
    // Only the receiver records "missed" if never answered
    if ((this.answer && !this.answered) || (to && to === this.authUser._id)) {
      await this.webRTC.registerMissedCall(from);
    }
  
    this.clearUnansweredTimeout();
    this.stopCallTimer();
    this.ringer.stop();
  
    await this.webRTC.close({ silent: true });
  
    // Reset flags so the UI reflects “not in call”
    this.calling = false;
    this.answered = false;
    this.hasAnswered = false;
  
    if (this.router.url.includes('/video')) {
      this.ngZone.run(() =>
        this.router.navigate(['/tabs/messages/list'], { replaceUrl: true })
      );
    }
  };

  this.socket.on(VideoEvents.CANCELED, async (ev) => {
    const to   = this.idOf(ev?.to);
    const from = this.idOf(ev?.from);

    // ✅ only the receiver records missed
    if (to === this.authUser._id && !this.answered) {
      await this.webRTC.registerMissedCall(from);
      console.log('[missed] CANCELED → stored for', from);
    }

    this.ringer.stop();
    this.webRTC.close();
    if (this.myEl)      { this.myEl.srcObject = null; this.myEl.pause(); }
    if (this.partnerEl) { this.partnerEl.srcObject = null; this.partnerEl.pause(); }
    this.messengerService.sendMessage({ event: 'stop-audio' });
    await this.toastService.presentStdToastr('Call was canceled.');
    this.leaveCallRoom();
    if (this.router.url.includes('/video')) {
      this.router.navigate(['/tabs/messages/list'], { replaceUrl: true });
    }
  });

  this.socket.on(VideoEvents.TIMEOUT, async (ev) => {
    const to   = this.idOf(ev?.to);
    const from = this.idOf(ev?.from);

    if (to === this.authUser._id && !this.answered) {
      await this.webRTC.registerMissedCall(from);
      console.log('[missed] TIMEOUT → stored for', from);
    }

    if (this.tearingDown) return;
    this.tearingDown = true;
    this.clearUnansweredTimeout();
    this.stopCallTimer();
    this.ringer.stop();
    await this.webRTC.close({ silent: true });
    this.leaveCallRoom();
    if (this.router.url.includes('/video')) {
      this.router.navigate(['/tabs/messages/list']);
    }
  });

  this.socket.on(VideoEvents.MISSED, (ev) => {
    // if backend emits a dedicated 'missed' event
    this.webRTC.addMissedCallFromSignaling(ev, this.authUser._id);
    this.toastService.presentStdToastr('Missed call.');
  });

  this.socket.on('cancel-video',         onCanceled);   // ⬅ important

}



  
private leaveCallRoom() {
  if (this.socket && this.socket.connected) {
    this.socket.emit('leave-call', {
      room : this.userId,        // or whatever room you use
      user : this.authUser._id,
    });
  }
}

  async init(myVideoEl: HTMLVideoElement, partnerVideoEl: HTMLVideoElement): Promise<void> {
    try {
        // ✅ Request user media (camera + mic)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        await this.webRTC.listAllMediaDevices();

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




  waitForAnswer() {
    const timer = setInterval(() => {
      if (this.partnerEl && this.partnerEl.srcObject) {
        this.ringer.stop();
        this.messengerService.sendMessage({ event: 'stop-audio' });
        this.answered = true;
        clearTimeout(this.callTimeout);

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

  private stopLocalStream() {
    try {
      this.localStream?.getTracks().forEach(t => t.stop());
    } catch {}
    this.localStream = null;
  }

  async closeCall(): Promise<void> {
    if (this.tearingDown) return;
    this.tearingDown = true;
  
    console.log('📴 Closing the call with full cleanup…');
  
    this.clearUnansweredTimeout();
    this.stopCallTimer();
    this.ringer.stop();
    if (this.answer && !this.answered && this.userId) {
      await this.webRTC.registerMissedCall(this.userId);
      console.log('[missed] closeCall fallback');
    }
    // Tell peer ONLY if we initiated the hangup
    if (!this.isRemoteEnd && this.socket?.connected) {
      await this.emitWebSocketEvent(VideoEvents.ENDED, {
        from: this.authUser._id,
        to  : this.userId,
      });
    }
    this.stopLocalStream();
    // Silence re-emit when remote ended
    await this.webRTC.close({ silent: this.isRemoteEnd });
    this.localStream = null;
  
    // Tidy up
    if (this.myEl)      { this.myEl.srcObject = null; this.myEl.pause(); }
    if (this.partnerEl) { this.partnerEl.srcObject = null; this.partnerEl.pause(); }
    this.leaveCallRoom();
  
    this.router.navigate(['/tabs/messages/list'], { replaceUrl: true });
    this.tearingDown = false;
  }
  


  async cancel(manualClose = false, reason: 'cancel' | 'timeout' = 'cancel'): Promise<void> {
    if (this.tearingDown) return;
    this.tearingDown = true;
  
    console.log('❌ Cancelling call…');
    this.clearUnansweredTimeout();
    this.stopCallTimer();
    this.ringer.stop();
    this.messengerService.sendMessage({ event: 'stop-audio' });
  
    if (this.socket?.connected) {
      if (!this.answered) {
        // ⬇️ normalized + legacy
        this.socket.emit(VideoEvents.CANCELED, { from: this.authUser._id, to: this.userId, reason });
        this.socket.emit('cancel-video', this.userId);
      } else {
        this.socket.emit(VideoEvents.ENDED, { from: this.authUser._id, to: this.userId });
      }
    }
  
    this.stopLocalStream();
    await this.webRTC.close({ silent: true });
  
    if (this.myEl)      { this.myEl.srcObject = null; this.myEl.pause(); }
    if (this.partnerEl) { this.partnerEl.srcObject = null; this.partnerEl.pause(); }
    this.localStream = null;
  
    if (!manualClose) this.router.navigate(['/tabs/messages/list']);
    this.tearingDown = false;
  }
  
  
  
  
  



startUnansweredTimeout() {
  this.clearUnansweredTimeout(); // cleanup if needed
  this.unansweredTimeout = setTimeout(() => {
    if (!this.answered) {
      console.warn('⏱️ Call unanswered after 30 seconds. Closing...');

      this.webRTC.registerMissedCall(this.userId);

      this.closeCall(); // this will also register missed call if not answered
    }
  }, 30000); // 30 seconds
}

clearUnansweredTimeout() {
  if (this.unansweredTimeout) {
    clearTimeout(this.unansweredTimeout);
    this.unansweredTimeout = null;
  }
}

async placeCall() {
  try {
    this.placingCall = true;
    this.calling     = true;
    this.ringer.start('ringing.mp3');

    await this.webRTC.waitForPeerOpen();

    if (!this.myEl || !this.partnerEl) await this.waitForVideoElements();

    // ensure fresh local stream
    if (this.localStream && !this.localStream.getTracks().some(t => t.readyState === 'live')) {
      this.localStream = null;
    }
    if (!this.localStream) {
      this.localStream = await this.webRTC.getUserMedia();
      if (!this.localStream) {
        this.toastService.presentStdToastr('Cannot access camera / mic');
        return;
      }
      this.showSelfPreview(this.localStream);
    }

    // tell WebrtcService who the peer is (used when closing)
    this.webRTC.partnerId = this.userId!;
    console.log('[peer:me]', {
      userId: this.webRTC.userId,
      peerId: WebrtcService.peer?.id,
      open:   WebrtcService.peer?.open
    });
    
    const mc = await this.webRTC.startCall(this.userId!, this.localStream);
    this.wireHangup(mc);
    mc.on('stream', (remote) => this.attachRemoteStream(remote));
    mc.on('error',  (e) => console.error('[call] error', e));

    this.calling = true;
  } catch (err: any) {
    this.toastService.presentStdToastr(err.message ?? String(err));
  } finally {
    this.placingCall = false;
  }
}




private attachRemoteStream(remote: MediaStream): void {
  const el = this.partnerVideoRef.nativeElement;
  el.srcObject = remote;

  const playNow = () => el.play().catch(() => {});
  if (el.readyState >= 1) { playNow(); }
  else                    { el.onloadedmetadata = playNow; }
}


// In video.component.ts - modify the answerCall() method
async answerCall(): Promise<void> {

  /* make sure cached stream is still live */
if (this.localStream &&
  !this.localStream.getTracks().some(t => t.readyState === 'live')) {
this.localStream = null;
}
if (this.hasAnswered) return;
this.hasAnswered = true;

  try {
    this.answeringCall = true;
    this.ringer.stop(); // ✅ Stop 'calling' sound on receiver
    this.startCallTimer();
    /* ── grab cam/mic only once ───────────────────────────── */
    if (!this.localStream) {
      this.localStream = await this.webRTC.getUserMedia();
      this.showSelfPreview(this.localStream);        // local tile
    }

    const incoming = WebrtcService.call;
    if (!incoming) { throw new Error('No incoming call'); }

    incoming.answer(this.localStream);
    this.wireHangup(incoming); 
    incoming.on('stream',  (remote) => this.attachRemoteStream(remote));
    incoming.on('error',   (e)      => console.error('[answer] error', e));
    this.ringer.stop();

    this.answered = true;
    this.countVideoCalls();

  } finally {
    this.answeringCall = false;
    this.cdr.detectChanges();
  }
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