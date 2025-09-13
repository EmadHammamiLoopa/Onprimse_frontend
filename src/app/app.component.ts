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
import { ToastService } from './services/toast.service';
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
    socketConnected: false,
  };

  private activityHandlers: { type: string; handler: any }[] = [];
  private connectionMonitorInterval: any;
  private wasOnline = true;

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
    private toastService: ToastService,
    private requestService: RequestService,
    private socketService: SocketService,
    private userService: UserService,
    public webRTC: WebrtcService,
  ) {
    this.initializeApp();
    this.setupSocketListeners(); // Call this in constructor
  }

  ngOnInit() {
    this.loadRequests();
  }

  ngOnDestroy() {
    // Cleanup event listeners
    this.activityHandlers.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler);
    });
  }

  private async setupSocketListeners() {
    try {
      await SocketService.initializeSocket();
      const socket = await SocketService.getSocket();
      this.socket = socket; // ✅ keep a reference

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
        { type: 'keydown', handler: activityHandler },
      ];
    } catch (error) {
      console.error('Failed to setup socket listeners:', error);
      // Retry after delay
      setTimeout(() => this.setupSocketListeners(), 5000);
    }
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
      LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (notification) => {
          const callerId = notification.notification.extra?.callerId;
          if (callerId) {
            this.router.navigate(['/messages/video', callerId], {
              queryParams: { answer: true },
            });
          }
        },
      );

      CapacitorApp.addListener('resume', () => {
        console.log('📱 App resumed - checking connections...');
        if (this.user?.id) {
          this.handleReconnection();
        } else {
          console.warn('⚠️ Skipping reconnection: user not yet loaded.');
        }
      });

      this.backgroundMode.on('activate').subscribe(() => {
        console.log('🌙 App in background - rechecking WebSocket...');
        if (this.user?.id) {
          SocketService.initializeSocket().then(() => {
            SocketService.bindToAuthUser();
          });
        } else {
          console.warn('⚠️ Skipping background socket re-init: user not ready.');
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



    setTimeout(() => {
      this.audio = new Audio('/assets/audio/ringing.mp3');
      this.audio.load();
      console.log('🎵 Preloaded ringing audio');
    }, 2000);
  }

  startConnectionMonitoring() {
    this.connectionMonitorInterval = setInterval(() => {
      const isOnline = navigator.onLine;
      if (isOnline !== this.wasOnline) {
        console.log(
          `🌐 Network status changed: ${isOnline ? 'Online' : 'Offline'}`,
        );
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
    if (!this.user?.id) {
      console.warn('⛔ User not initialized');
      return;
    }

    try {
      await SocketService.initializeSocket();
      SocketService.bindToAuthUser();

      if (!WebrtcService.peer || WebrtcService.peer.disconnected) {
        await this.initWebrtc();
      }

      console.log('✅ All services reconnected successfully');
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      setTimeout(() => this.handleReconnection(), 10000);
    }
  }

  private handleOffline() {
    console.log('⚠️ App is offline - queuing operations');
    // Implement offline queue if needed
  }

  ionViewWillEnter() {
    // this.oneSignalService.close();
  }

  loadRequests() {
    this.requestService
      .requests(0)
      .then((resp: any) => {
        if (!resp || !resp.data) {
          console.warn('No request data received. Defaulting to 0.');
          this.newRequestsCount = 0;
          return;
        }
        this.newRequestsCount = resp.data.length;
      })
      .catch((err) => {
        console.error('Error in loadRequests:', err);
        this.newRequestsCount = 0;
      });
  }

  async presentModal(data: any[], title: string) {
    let modalData = data;
    if (!Array.isArray(data)) {
      console.error('Input data is not an array:', data);
      modalData = Object.keys(data).map((key) => ({
        name: key,
        values: data[key],
      }));
    }

    const modal = await this.modalCtrl.create({
      component: ListSearchComponent,
      componentProps: { data: modalData, title },
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
    this.audio
      .play()
      .then(() => {
        console.log('🎵 Audio started playing successfully');
      })
      .catch((error) => {
        console.warn('⚠️ Audio autoplay prevented:', error);
      });
  }

  async connectUser() {
    try {
      const socket = await SocketService.getSocket();
      this.socket = socket;

      SocketService.emit('connect-user', this.user.id);

      // Avoid duplicate handlers on reconnect
      socket.off('called').on('called', (data) => {
        console.log('📞 Incoming call from:', data.callerId);
        localStorage.setItem('partnerId', data.callerId);

        this.playAudio('/assets/audio/ringing.mp3');

        this.messengerService.onMessage().subscribe((msg) => {
          if (msg?.event === 'stop-audio') this.audio?.pause();
        });

        CapacitorApp.getState().then((state) => {
          if (state.isActive) {
            this.router.navigate(['/messages/video', data.callerId], {
              queryParams: { answer: true },
            });
          } else {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: 1,
                  title: '📞 Incoming Call',
                  body: 'You have an incoming video call',
                  schedule: { at: new Date(Date.now() + 1000) },
                  extra: { callerId: data.callerId },
                },
              ],
            });
          }
        });
      });

      socket.off('video-canceled').on('video-canceled', () => {
        console.log('🚫 Call canceled.');
        this.audio?.pause();
        localStorage.removeItem('partnerId');
      });
    } catch (e) {
      console.error('connectUser failed:', e);
    }
  }

  getUserData() {
    if (this.platform.is('cordova')) {
      this.nativeStorage
        .getItem('user')
        .then((userData) => {
          const parsedUser =
            typeof userData === 'string' ? JSON.parse(userData) : userData;
          this.initializeUser(parsedUser);
        })
        .catch((error) => {
          console.warn(
            'Error fetching user data from NativeStorage:',
            error,
          );
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
    }
  }

  private async initializeUser(user: any) {
    this.user = new User().initialize(user);
    this.filterAvatars();

    try {
      await SocketService.initializeSocket();
      SocketService.bindToAuthUser();
    } catch (err) {
      console.error('WebSocket initialization failed:', err);
    }

    setTimeout(() => this.initWebrtc(), 500);
    this.connectUser();
    this.changeDetectorRef.detectChanges();
  }

  private filterAvatars() {
    if (this.user.avatar) {
      this.user.avatar = this.user.avatar.filter(
        (url) => url.startsWith('http') && url !== '',
      );
    }
    this.changeDetectorRef.detectChanges();
  }

  private async initWebrtc() {
    if (!this.user?.id) {
      console.error('❌ No authenticated user found');
      return;
    }

    try {
      if (
        WebrtcService.peer &&
        (WebrtcService.peer.disconnected ||
          WebrtcService.peer.destroyed ||
          !this.validatePeerId(WebrtcService.peer.id, this.user.id))
      ) {
        WebrtcService.peer.destroy();
        WebrtcService.peer = null;
      }

      if (!WebrtcService.peer) {
        await this.webRTC.createPeer(this.user.id);
        console.log('[peer:me]', {
          userId: this.webRTC.userId,
          peerId: WebrtcService.peer?.id,
          open:   WebrtcService.peer?.open
        });
        
        await this.waitForPeerOpen();

        const myPeerId = this.webRTC.getPeerId();
        if (!myPeerId?.startsWith(this.user.id)) {
          console.warn('Peer ID mismatch; clearing and recreating…', { myPeerId, userId: this.user.id });
          localStorage.removeItem('peerId');
          try { WebrtcService.peer?.destroy(); } catch {}
          WebrtcService.peer = null;
          await this.webRTC.createPeer(this.user.id);
          await this.waitForPeerOpen();
        }
        

        const existing = localStorage.getItem('lastPeerIdSent');
        if (!existing || existing.trim() === '') {
          localStorage.setItem('lastPeerIdSent', myPeerId);
          console.log('📌 Stored lastPeerIdSent in localStorage:', myPeerId);
        }

        console.log(`✅ PeerJS initialized. My ID: ${myPeerId}`);
      }

      this.webRTC.wait();

      const partnerId = localStorage.getItem('partnerId');
      if (partnerId && partnerId !== this.user.id) {
        this.userService.getPartnerPeerId(partnerId).subscribe({
          next: (partnerPeerId) => {
            if (!partnerPeerId?.startsWith(partnerId)) {
              console.warn('⚠️ Invalid partner peer ID format');
              return;
            }
            if (partnerPeerId === this.webRTC.getPeerId()) {
              console.warn('⚠️ Cannot call self');
              return;
            }
          },
          error: (err) => {
            console.error('❌ Partner peer lookup failed:', err);
            this.toastService.presentStdToastr(
              'Could not connect to partner',
            );
          },
        });
      }
    } catch (err) {
      console.error('❌ WebRTC initialization failed:', err);
      setTimeout(() => this.initWebrtc(), 5000);
    }
  }

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
        return reject(new Error('⛔ Peer instance not initialized'));
      }
      WebrtcService.peer.once('open', () => resolve(true));
      setTimeout(() => reject(new Error('⏰ Peer open timeout')), 10000);
    });
  }

  getJsonData() {
    this.jsonService.getCountries().then((resp: any) => {
      this.countries = Array.isArray(resp)
        ? resp
        : Object.keys(resp).map((key) => ({ name: key, values: resp[key] }));

      this.nativeStorage
        .setItem('countries', JSON.stringify(this.countries))
        .catch((error) => {
          console.warn(
            'NativeStorage not available, using localStorage fallback',
            error,
          );
          localStorage.setItem(
            'countries',
            JSON.stringify(this.countries),
          );
        });
    });

    this.jsonService.getCurrencies().then((resp: any) => {
      this.currencies = resp;
      this.nativeStorage
        .setItem('currencies', JSON.stringify(resp))
        .catch((error) => {
          console.warn(
            'NativeStorage not available, using localStorage fallback',
            error,
          );
          localStorage.setItem('currencies', JSON.stringify(resp));
        });
    });

    this.jsonService.getEducations().then((resp: any) => {
      this.educations = resp;
      this.nativeStorage
        .setItem('educations', JSON.stringify(resp))
        .catch((error) => {
          console.warn(
            'NativeStorage not available, using localStorage fallback',
            error,
          );
          localStorage.setItem('educations', JSON.stringify(resp));
        });
    });

    this.jsonService.getProfessions().then((resp: any) => {
      this.professions = resp;
      this.nativeStorage
        .setItem('professions', JSON.stringify(resp))
        .catch((error) => {
          console.warn(
            'NativeStorage not available, using localStorage fallback',
            error,
          );
          localStorage.setItem('professions', JSON.stringify(resp));
        });
    });

    this.jsonService.getInterests().then((resp: any) => {
      this.interests = resp;
      this.nativeStorage
        .setItem('interests', JSON.stringify(resp))
        .catch((error) => {
          console.warn(
            'NativeStorage not available, using localStorage fallback',
            error,
          );
          localStorage.setItem('interests', JSON.stringify(resp));
        });
    });
  }

  async onOffline() {
    this.router.navigate(['/internet-error']);
  }
}
