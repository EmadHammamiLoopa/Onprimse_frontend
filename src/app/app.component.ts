import { ChangeDetectorRef, Component } from '@angular/core';
import { Platform, ModalController } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { JsonService } from './services/json.service';
import { Router } from '@angular/router';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { Network } from '@ionic-native/network/ngx';
import { OneSignalService } from './services/one-signal.service';
import { WebrtcService } from './services/webrtc.service';
import { MessengerService } from './pages/messenger.service';
import { AdMobFeeService } from './services/admobfree.service';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { User } from './models/User';
import { SocketService } from './services/socket.service';
import { ListSearchComponent } from '../app/pages/list-search/list-search.component';
import { ToastService } from './services/toast.service'; // Import ToastService
import { RequestService } from './services/request.service';
import { Socket } from 'socket.io-client';
import { UserService } from './services/user.service';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapacitorApp } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  socket: Socket | null = null; // Use the Socket type from socket.io-client
  user: User;
  audio: HTMLAudioElement;
  newRequestsCount: number = 0;
  showSplash = true;
  myEl?: HTMLVideoElement;
  partnerEl?: HTMLVideoElement;
  
  countries = [];
  currencies = {};
  educations = [];
  professions = [];
  interests = [];
  selectedCountry: any;
  selectedCity: any;
  selectedProfession: any;
  selectedInterests: any;
  public connectionStatus = {
    online: true,
    peerConnected: false,
    socketConnected: false
  };
  
  constructor(
    private platform: Platform,
    private nativeStorage: NativeStorage,
    private jsonService: JsonService,
    private oneSignalService: OneSignalService,
    private webrtcService: WebrtcService,
    private statusBar: StatusBar,
    private splashScreen: SplashScreen,
    private network: Network,
    private router: Router,
    private messengerService: MessengerService,
    private adMobFreeService: AdMobFeeService,
    private backgroundMode: BackgroundMode,
    private modalCtrl: ModalController,
    private changeDetectorRef: ChangeDetectorRef,
    private toastService: ToastService, // Inject ToastService
    private requestService: RequestService,
    private socketService: SocketService, // ✅ Inject SocketService
private userService: UserService,
public webRTC: WebrtcService,

  ) {

    
    this.initializeApp();
    this.setupSocketListeners(); // Call this in constructor

  }

  ngOnInit() {
    this.loadRequests();
  }


  private async setupSocketListeners() {
    try {
      await SocketService.initializeSocket();
      const socket = await SocketService.getSocket(); // Important: await the socket
      
      // Heartbeat response
      socket.on('ping', () => {
        socket.emit('pong');
        console.log('❤️ Responded to server ping');
      });

      // Track user activity globally
      const activityHandler = () => this.trackUserActivity();
      document.addEventListener('mousemove', activityHandler);
      document.addEventListener('keydown', activityHandler);

      // Store for cleanup
      this.activityHandlers = [
        { type: 'mousemove', handler: activityHandler },
        { type: 'keydown', handler: activityHandler }
      ];

    } catch (error) {
      console.error('Failed to setup socket listeners:', error);
      // Retry after delay
      setTimeout(() => this.setupSocketListeners(), 5000);
    }
  }
  
  private activityHandlers: {type: string, handler: any}[] = [];

  ngOnDestroy() {
    // Cleanup event listeners
    this.activityHandlers.forEach(({type, handler}) => {
      document.removeEventListener(type, handler);
    });
  }
  private trackUserActivity() {
    if (this.user?.id) {
      SocketService.emit('user-activity', this.user.id);
    }
  }

  initializeApp() {
    this.platform.ready().then(async () => {
      // ✅ Ask notification permission
      await LocalNotifications.requestPermissions();
      SocketService.initializeSocket();

      // ✅ Handle notification click when app is in background
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const callerId = notification.notification.extra?.callerId;
        if (callerId) {
          this.router.navigate(['/messages/video', callerId], {
            queryParams: { answer: true }
          });
        }
      });

      CapacitorApp.addListener('resume', () => {
        console.log("📱 App resumed - checking connections...");
        if (this.user?.id) {
          this.handleReconnection();
        } else {
          console.warn("⚠️ Skipping reconnection: user not yet loaded.");
        }
      });
      
      this.backgroundMode.on('activate').subscribe(() => {
        console.log("🌙 App in background - rechecking WebSocket...");
        if (this.user?.id) {
          SocketService.initializeSocket().then(() => {
            SocketService.registerUser(this.user.id);
          });
        }

        else {
          console.warn("⚠️ Skipping background socket re-init: user not ready.");
        }
      });
      
      
  
      // ✅ Cordova-specific setup
      if (this.platform.is('cordova')) {
        this.statusBar.styleDefault();
        this.splashScreen.hide();
        this.backgroundMode.enable();
  
        this.network.onDisconnect().subscribe(() => {
          this.onOffline();
        });
      } else {
        console.log('Running in browser, Cordova not available');
      }
  
      // ✅ Initialize user & data
      this.getUserData();  
      this.getJsonData();
  
      setTimeout(() => {
        this.showSplash = false;
      }, 8000);
    });
  
    // ✅ Setup video elements after short delay
    setTimeout(() => {
      this.myEl = document.querySelector('#my-video') as HTMLVideoElement;
      this.partnerEl = document.querySelector('#partner-video') as HTMLVideoElement;
  
      if (this.myEl && this.partnerEl) {
        console.log("✅ Video elements found in AppComponent");
        this.webRTC.myEl = this.myEl;
        this.webRTC.partnerEl = this.partnerEl;
      } else {
        console.warn("⚠️ Video elements not yet available in AppComponent");
      }
    }, 1000);

    setTimeout(() => {
      this.audio = new Audio('/assets/audio/ringing.mp3');
      this.audio.load();
      console.log("🎵 Preloaded ringing audio");
    }, 2000);
    
  }
  
  

  // In AppComponent
private connectionMonitorInterval: any;
private wasOnline = true;

startConnectionMonitoring() {
  this.connectionMonitorInterval = setInterval(() => {
    const isOnline = navigator.onLine;
    
    if (isOnline !== this.wasOnline) {
      console.log(`🌐 Network status changed: ${isOnline ? 'Online' : 'Offline'}`);
      this.wasOnline = isOnline;
      
      if (isOnline) {
        this.handleReconnection();
      } else {
        this.handleOffline();
      }
    }
  }, 5000); // Check every 5 seconds
}

private async handleReconnection() {
  console.log('🔄 Attempting to reconnect all services...');

  if (!this.user || !this.user.id) {
    console.warn("⛔ User not initialized yet. Skipping reconnection.");
    return;
  }

  try {
    // Reinitialize WebSocket
    await SocketService.initializeSocket(); // Just initialize the connection
    SocketService.registerUser(this.user.id); // Register user separately after connected
    
    // Reinitialize PeerJS if needed
    if (!WebrtcService.peer || WebrtcService.peer.disconnected) {
      await this.initWebrtc();
    }

    console.log('✅ All services reconnected successfully');
  } catch (error) {
    console.error('❌ Reconnection failed:', error);
    setTimeout(() => this.handleReconnection(), 10000); // Retry after delay
  }
}



private handleOffline() {
  console.log('⚠️ App is offline - queuing operations');
  // Implement offline queue if needed
}

  ionViewWillEnter() {
  //  this.oneSignalService.close();
  }


  loadRequests() {
    this.requestService.requests(0).then((resp: any) => {
        if (!resp || !resp.data) { // ✅ Check if `resp` and `resp.data` exist
            console.warn("No request data received. Defaulting to 0.");
            this.newRequestsCount = 0;
            return;
        }

        this.newRequestsCount = resp.data.length;
    }).catch(err => {
        console.error("Error in loadRequests:", err);
        this.newRequestsCount = 0; // ✅ Prevent app crash by setting a default value
    });
}

  
  async presentModal(data: any[], title: string) {
    let modalData = data;

    if (!Array.isArray(data)) {
      console.error('Input data is not an array:', data);
      modalData = Object.keys(data).map(key => ({ name: key, values: data[key] }));
    }

    const modal = await this.modalCtrl.create({
      component: ListSearchComponent,
      componentProps: { data: modalData, title }
    });

    modal.onDidDismiss().then((result) => {
      console.log(`Selected ${title}:`, result.data);
      if (title === 'Countries') {
        this.selectedCountry = result.data;
      } else if (title === 'Cities') {
        this.selectedCity = result.data;
      } else if (title === 'Professions') {
        this.selectedProfession = result.data;
      } else if (title === 'Interests') {
        this.selectedInterests = result.data;
      }
    });

    return await modal.present();
  }

  async presentCountriesModal() {
    await this.presentModal(this.countries, 'Countries');
  }

  async presentProfessionsModal() {
    await this.presentModal(this.professions, 'Professions');
  }

  async presentEducationsModal() {
    await this.presentModal(this.educations, 'Educations');
  }

  async presentInterestsModal() {
    await this.presentModal(this.interests, 'Interests');
  }

  playAudio(src: string) {
    console.log('play app audio');
    console.log(src);
    
    if (!this.audio) {
      this.audio = new Audio();
    }
  
    this.audio.src = src;
    this.audio.load();
    this.audio.loop = true;
  
    this.audio.play().then(() => {
      console.log("🎵 Audio started playing successfully");
    }).catch(error => {
      console.warn('⚠️ Audio autoplay prevented:', error);
    });
  }
  
  connectUser() {
    if (!this.socket || !this.socket.emit) {
        console.error('❌ Socket is not initialized.');
        return;
    }

    this.socket.emit('connect-user', this.user.id);
    this.socket.on('called', (data) => {
        console.log("📞 Incoming call from:", data.callerId);

        // ✅ Store partner ID for WebRTC connection
        localStorage.setItem('partnerId', data.callerId);

        this.playAudio('/assets/audio/ringing.mp3');

        this.messengerService.onMessage().subscribe((msg) => {
            if (msg?.event === 'stop-audio') {
                this.audio.pause();
            }
        });

        console.log("📡 WebRTC connection initialized.");
        this.initWebrtc(); // ✅ Initialize WebRTC with stored partner ID

          // ✅ Navigate to video screen with `answer=true`
          CapacitorApp.getState().then(state => {
            if (state.isActive) {
              // App is in foreground – go to video screen
              this.router.navigate(['/messages/video', data.callerId], {
                queryParams: { answer: true }
              });
            } else {
              // App is in background – show local notification
              LocalNotifications.schedule({
                notifications: [
                  {
                    id: 1,
                    title: '📞 Incoming Call',
                    body: 'You have an incoming video call',
                    schedule: { at: new Date(Date.now() + 1000) },
                    sound: 'ringtone.mp3', // Optional
                    extra: {
                      callerId: data.callerId
                    }
                  }
                ]
              });
            }
          });

    });

    this.socket.on('video-canceled', () => {
        console.log("🚫 Call canceled.");
        if (this.audio) this.audio.pause();
        localStorage.removeItem('partnerId'); // ✅ Clear stored partner ID
    });
}


  getUserData() {
    if (this.platform.is('cordova')) {
      this.nativeStorage.getItem('user')
      .then(userData => {
        // NativeStorage stores as string, parse it
        const parsedUser = typeof userData === 'string' ? JSON.parse(userData) : userData;
        this.initializeUser(parsedUser);
      })
      .catch(error => {
        console.warn('Error fetching user data from NativeStorage:', error);
        this.fetchUserFromLocalStorage();
      });
    } else {
      this.fetchUserFromLocalStorage();
    }
  }
  
  private fetchUserFromLocalStorage() {
    const userString = localStorage.getItem('user');
    if (userString) {
      try {
        const parsedUser = JSON.parse(userString);
        console.log('Fetched user data from localStorage:', parsedUser);
        this.initializeUser(parsedUser);
      } catch (err) {
        console.error('Failed to parse user JSON from localStorage:', err);
      }
    } else {
      console.log('User data not found in localStorage');
      // Redirect to login or show error if needed
    }
  }
  
  
  private initializeUser(user: any) {
    this.user = new User().initialize(user);
    this.filterAvatars();
    SocketService.initializeSocket().then(() => {
      // ✅ Register user only after socket is ready
      if (this.user?.id) {
        SocketService.registerUser(this.user.id);
      }
    }).catch(err => {
      console.error("WebSocket initialization failed:", err);
    });
  
    setTimeout(() => this.initWebrtc(), 500);
    this.connectUser();
    this.changeDetectorRef.detectChanges();
  }
  
  private filterAvatars() {
    if (this.user.avatar) {
      this.user.avatar = this.user.avatar.filter(url => url.startsWith('http') && url !== '');
    }
    this.changeDetectorRef.detectChanges(); // Trigger Angular change detection
  }


  
  

  private async initWebrtc() {
    if (!this.user?.id) {
      console.error("❌ No authenticated user found");
      return;
    }
  
    try {
      // Clear any existing peer connection if invalid
      if (WebrtcService.peer && 
          (WebrtcService.peer.disconnected || 
           WebrtcService.peer.destroyed ||
           !this.validatePeerId(WebrtcService.peer.id, this.user.id))) {
        WebrtcService.peer.destroy();
        WebrtcService.peer = null;
      }
  
      // Initialize new peer connection if needed
      if (!WebrtcService.peer) {
        await this.webRTC.createPeer(this.user.id);
        await this.waitForPeerOpen();
        
        const myPeerId = this.webRTC.getPeerId();
        if (!myPeerId?.startsWith(this.user.id)) {
          throw new Error(`Peer ID ${myPeerId} doesn't match user ${this.user.id}`);
        }
        const existing = localStorage.getItem('lastPeerIdSent');
        if (!existing || existing.trim() === '') {
          localStorage.setItem('lastPeerIdSent', myPeerId);
          console.log('📌 Stored lastPeerIdSent in localStorage:', myPeerId);
        }
        console.log(`✅ PeerJS initialized. My ID: ${myPeerId}`);
      }
  
      // Start listening for incoming calls
      this.webRTC.wait();
  
      // Handle outgoing call if partner ID exists
      const partnerId = localStorage.getItem('partnerId');
      if (partnerId && partnerId !== this.user.id) {
        this.userService.getPartnerPeerId(partnerId).subscribe({
          next: (partnerPeerId) => {
            if (!partnerPeerId?.startsWith(partnerId)) {
              console.warn("⚠️ Invalid partner peer ID format");
              return;
            }
            if (partnerPeerId === this.webRTC.getPeerId()) {
              console.warn("⚠️ Cannot call self");
              return;
            }
            this.webRTC.callPartner(partnerPeerId);
          },
          error: (err) => {
            console.error("❌ Partner peer lookup failed:", err);
            this.toastService.presentStdToastr("Could not connect to partner");
          }
        });
      }
    } catch (err) {
      console.error("❌ WebRTC initialization failed:", err);
      // Optional: retry after delay
      setTimeout(() => this.initWebrtc(), 5000);
    }
  }
  
  // Add this helper method to validate peer IDs
  private validatePeerId(peerId: string, expectedUserId: string): boolean {
    if (!peerId || !expectedUserId) return false;
    return peerId.startsWith(expectedUserId);
  }
  

  
  private async waitForPeerOpen() {
    return new Promise((resolve, reject) => {
      if (WebrtcService.peer && WebrtcService.peer.open) {
        return resolve(true);
      }
  
      if (!WebrtcService.peer) {
        return reject(new Error("⛔ Peer instance not initialized"));
      }
  
      WebrtcService.peer.once('open', () => resolve(true));
      setTimeout(() => reject(new Error("⏰ Peer open timeout")), 10000);
    });
  }
  
  


  getJsonData() {
    this.jsonService.getCountries()
      .then((resp: any) => {
        //console.log('Countries response:', resp); // Log the response
        if (Array.isArray(resp)) {
          this.countries = resp;
        } else {
          this.countries = Object.keys(resp).map(key => ({ name: key, values: resp[key] }));
        }
        this.nativeStorage.setItem('countries', JSON.stringify(this.countries)).catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          localStorage.setItem('countries', JSON.stringify(this.countries));
        });
       // console.log('Countries fetched:', this.countries);
      });
  
    this.jsonService.getCurrencies()
      .then((resp: any) => {
      //  console.log('Currencies response:', resp); // Log the response
        this.currencies = resp;
        this.nativeStorage.setItem('currencies', JSON.stringify(resp)).catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          localStorage.setItem('currencies', JSON.stringify(resp));
        });
        //console.log('Currencies fetched:', resp);
      });
  
    this.jsonService.getEducations()
      .then((resp: any) => {
        //console.log('Educations response:', resp); // Log the response
        this.educations = resp;
        this.nativeStorage.setItem('educations', JSON.stringify(resp)).catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          localStorage.setItem('educations', JSON.stringify(resp));
        });
       // console.log('Educations fetched:', resp);
      });
  
    this.jsonService.getProfessions()
      .then((resp: any) => {
      //  console.log('Professions response:', resp); // Log the response
        this.professions = resp;
        this.nativeStorage.setItem('professions', JSON.stringify(resp)).catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          localStorage.setItem('professions', JSON.stringify(resp));
        });
        //console.log('Professions fetched:', resp);
      });
  
    this.jsonService.getInterests()
      .then((resp: any) => {
        //console.log('Interests response:', resp); // Log the response
        this.interests = resp;
        this.nativeStorage.setItem('interests', JSON.stringify(resp)).catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          localStorage.setItem('interests', JSON.stringify(resp));
        });
        //console.log('Interests fetched:', resp);
      });
  }

  async onOffline() {
    this.router.navigate(['/internet-error']);
  }
}