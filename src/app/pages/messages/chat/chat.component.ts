import { Location } from '@angular/common';
import { ToastService } from './../../../services/toast.service';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { UploadFileService } from './../../../services/upload-file.service';
import { MessageService } from './../../../services/message.service';
import { User } from 'src/app/models/User';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from './../../../services/user.service';
import { Message } from './../../../models/Message';
import { Camera } from '@ionic-native/camera/ngx';
import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { IonContent, IonInfiniteScroll, Platform, AlertController } from '@ionic/angular';
import { SocketService } from 'src/app/services/socket.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { ProductService } from 'src/app/services/product.service';
import { Product } from 'src/app/models/Product';
import { from } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { take } from 'rxjs/operators';
import { File as IonicFile, FileEntry } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { NgZone } from '@angular/core';
import { AppEventsService } from 'src/app/services/app-events.service';

interface ImageFileObject {
  file: File;
  imageData: string;
}

// ⬇️  put this just above the class or anywhere in the file ­- it’s private to the module
const waitUntil = (cond: () => boolean, step = 100) =>
  new Promise<void>(res => {
    const t = setInterval(() => cond() && (clearInterval(t), res()), step);
  });

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})



export class ChatComponent implements OnInit {
  videoCallDeclined = false;

  page = 0;
  resend = [];
  product: Product;
  productId: string;

  sentMessages = {};
  index = 0;
  private listenersBound = false;

  image: string = null;
  imageFile: ImageFileObject = null;
  messageText = "";
  private activityListeners: any[] = [];
  private lastActivityTime = Date.now();

  connected = false;
  @ViewChild('content') private content: IonContent;
  @ViewChild('infScroll') private infScroll: IonInfiniteScroll;

  messages: Message[] = [];
    groupedMessages: any[] = []; // For date grouping

  socket: any;
  user: User;
  authUser: User;
  pageLoading = false;
  private sendMessageCounter = 0;

  allowToChat = false;
  business = false;
  showMediaOptions: boolean = false;


  
  constructor(private camera: Camera, private userService: UserService, private route: ActivatedRoute,private sanitizer: DomSanitizer,
              private messageService: MessageService, private changeDetection: ChangeDetectorRef,
              private platform: Platform, private uploadFileService: UploadFileService, private webView: WebView,  private file: IonicFile,
              private filePath: FilePath,private zone: NgZone, private badges: AppEventsService,
              private toastService: ToastService, private location: Location, private router: Router, private productService: ProductService, 
              private alertController: AlertController, private socketService: SocketService, private nativeStorage: NativeStorage) {
                
  }

  ngOnInit() {
    console.log("ngOnInit called");
    this.getAuthUser();
  
    this.route.paramMap.subscribe(params => {
      const userId = params.get('id');
      if (userId) {
        console.log("User ID detected:", userId);
        this.getUserProfile(userId);
        this.videoCallDeclined = false;
        this.initializeSocket(); // Pass userId directly

      }
    });
  
    this.route.queryParams.subscribe(queryParams => {
      const productId = queryParams['productId'];
      if (productId) {
        console.log("Product ID detected:", productId);
        this.productId = productId;
        this.getProductDetails(productId);
      }
    });
    this.setupActivityTracking();

  }
  
  private setupActivityTracking() {
    // Remove any existing listeners first
    this.removeActivityListeners();
  
    // Track various user interactions
    const events = ['mousemove', 'scroll', 'click', 'keydown', 'touchstart'];
    
    events.forEach(event => {
      const handler = () => this.handleUserActivity();
      window.addEventListener(event, handler);
      this.activityListeners.push({ event, handler });
    });
  }
  
  private handleUserActivity() {
    this.lastActivityTime = Date.now();
    if (this.socket && this.socket.connected && this.user?.id) {
      this.socket.emit('user-activity', this.user.id);
    }
  }
  
  private removeActivityListeners() {
    this.activityListeners.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
    this.activityListeners = [];
  }
  
  ngOnDestroy() {
    this.removeActivityListeners();
  }

  ionViewWillEnter() {
    console.log("ionViewWillEnter called");
    this.badges.reset('messages');

    this.pageLoading = true;
    this.getUserId();
    if (this.authUser && this.authUser.id) {
      this.route.paramMap.subscribe(params => {
        console.log("user params..................detected:", params);

        const userId = params.get('id');
        if (userId) {
          this.getUserProfile(userId);
        } else if (this.productId) {
          this.getProductDetails(this.productId);
        } else {
          this.pageLoading = false;
        }
      });
    }
  }
  
  toggleMediaOptions() {
    this.showMediaOptions = !this.showMediaOptions;
  }

  private markThreadRead() {
    if (this.socket?.connected && this.user?.id) {
      this.socket.emit('mark-thread-read', { peerId: this.user.id });
    }
    // ✅ also hard reset locally
    this.badges.reset('messages');
  }

  getProductDetails(productId: string, event?) {
    if (!event) this.pageLoading = true;
    this.productService.get(productId).then(
      (resp: any) => {
        this.pageLoading = false;
        this.product = new Product().initialize(resp.data);
        if (event) event.target.complete();
      },
      err => {
        this.pageLoading = false;
        if (event) event.target.complete();
        this.toastService.presentStdToastr(err);
      }
    );
  }

  goBack() {
    this.location.back();
  }
  
  openMenu() {
    console.log('Menu opened'); // You can implement real menu later if needed
  }

  
  acceptVideoCall(message: Message) {
    SocketService.emit('video-call-accepted', {
      from: this.authUser.id,
      to: message.from,
      messageId: message.id
    });
    this.user.isFriend = true;
  }
  
  declineVideoCall(message: Message) {
    SocketService.emit('video-call-declined', {
      from: this.authUser.id,
      to: message.from,
      messageId: message.id
    });
  }

  
  formatLastSeen(lastActive: Date): string {
    if (!lastActive) return 'unknown';
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastActive).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  }

  getAuthUser() {
    this.pageLoading = true;
    this.nativeStorage.getItem('user').then(
      (user) => {
        if (user) {
          this.authUser = new User().initialize(user);
          console.log("✅ Authenticated user:", this.authUser);
          this.getUserId();
        } else {
          this.fallbackToLocalStorage();
        }
      },
      (err) => this.fallbackToLocalStorage()
    );
  }
  
  fallbackToLocalStorage() {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsedUser = JSON.parse(stored);
        this.authUser = new User().initialize(parsedUser);
        console.log("✅ Loaded from localStorage:", this.authUser);
        this.getUserId();
      } else {
        console.error("❌ No user data found.");
        this.pageLoading = false;
      }
    } catch (err) {
      console.error("❌ Error parsing localStorage user data:", err);
      this.pageLoading = false;
    }
  }
  
  

  handleUserInitError() {
    this.pageLoading = false;
    this.router.navigate(['/auth/signin']);
  }

  getUserId() {
    if (this.authUser && this.authUser.id) {
      this.route.paramMap.subscribe(params => {
        const id = params.get('id');
        if (id && this.authUser.id !== id) {
          this.getUserProfile(id); // Fetch the recipient's profile (seller)
        } else {
          console.error('Recipient ID is the same as authenticated user ID or missing');
          this.handleUserInitError();
        }
      });
    } else {
      this.handleUserInitError();
    }
  }
  
  
getUserProfile(userId: string) {
  if (!userId) { this.pageLoading = false; return; }

  console.log('Fetching profile for user ID:', userId);
  this.userService.getUserProfile(userId).subscribe(
    async (resp: any) => {
      const raw = resp?.data ?? resp;                         // unchanged
      if (!raw) {                                             // unchanged
        this.pageLoading = false;
        this.toastService.presentStdToastr('Sorry, this user is not available');
        return this.location.back();
      }

      this.user = new User().initialize(raw);
      console.log('Recipient stored:', this.user);

      /* 🆕  wait until authUser is ready, then load only once */
      await waitUntil(() => !!this.authUser?.id);
      if (!this.messages.length) this.getMessages();          // prevents duplicate loads
    },
    err => {                                                  // unchanged
      this.pageLoading = false;
      this.toastService.presentStdToastr('Sorry, this user is not available');
      this.location.back();
    }
  );
}

  
  
  
async initializeSocket() {
  try {
    await SocketService.initializeSocket();
    this.socket = await SocketService.getSocket();

    // (Optional but safe/idempotent) ensure the server binds this socket to the JWT user
    SocketService.bindToAuthUser();

    this.initSocketListeners();
  } catch (error) {
    console.error("❌ Socket initialization failed:", error);
    setTimeout(() => this.initializeSocket(), 5000);
  }
}
  
  


  getUser(id: string) {
    this.getUserProfile(id);
  }


// Group messages by date
groupMessagesByDate() {
  const grouped = [];
  let currentDate = null;
  let currentGroup = null;

  // Sort messages by date (oldest first)
  const sortedMessages = [...this.messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  sortedMessages.forEach(message => {
    const messageDate = this.formatMessageDate(message.createdAt);
    
    if (messageDate !== currentDate) {
      currentGroup = {
        date: messageDate,
        messages: []
      };
      grouped.push(currentGroup);
      currentDate = messageDate;
    }
    
    currentGroup.messages.push(message);
  });

  this.groupedMessages = grouped;
  this.changeDetection.detectChanges();
}

// Format date for grouping
formatMessageDate(date: Date | string): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time parts for comparison
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  messageDate.setHours(0, 0, 0, 0);

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return messageDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

// Format time for display
formatMessageTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
}

  // Scroll to bottom when new messages arrive
  scrollToBottom() {
    setTimeout(() => {
      this.content.scrollToBottom(300);
    }, 100);
  }

  async getMessages(event?) {
    if (!this.socket) {
      console.warn("⚠️ WebSocket is not ready. Trying to reinitialize...");
      if (this.user?.id) {
        await this.initializeSocket();
      } else {
        console.error("❌ Cannot reinitialize WebSocket: User ID missing.");
        return;
      }
    }
  
    if (this.pageLoading) {
      console.warn("⚠️ Already loading messages, skipping request.");
      this.pageLoading = false;
      return;
    }
    
    this.pageLoading = true;
    console.log("📩 Fetching messages...");
  
    try {
      const resp: any = await this.messageService.indexMessages(this.user?.id || this.productId, this.page++);
      
      if (!resp.data?.messages?.length) {
        console.log("✅ No new messages found.");
        this.pageLoading = false;
        return;
      }
      if (this.page === 1) this.markThreadRead();

      // Ensure no duplicate messages are pushed
      const newMessages = resp.data.messages.map(msg => {
        if (msg.image && typeof msg.image === 'object' && msg.image.path) {
          msg.image = msg.image.path;
        }
        return new Message().initialize(msg);
      });
      const existingMessageIds = new Set(this.messages.map(msg => msg.id));
  
      newMessages.forEach(msg => {
        if (!existingMessageIds.has(msg.id)) {
          this.messages.unshift(msg);
        }
      });
  
      // Group messages after updating
      this.groupMessagesByDate();
      
      console.log(`✅ Messages loaded: ${this.messages.length}`);
      this.pageLoading = false;
  
      if (!resp.data.more) {
        this.infScroll.disabled = true;
      }
  
      if (event) {
        event.target.complete();
      }
    } catch (error) {
      console.error("❌ Error loading messages:", error);
      this.toastService.presentStdToastr(error);
    }
  }
  
  
  
  
  
  
  isProductMessage(message: Message): boolean {
    return message.type === 'product';
  }
  

  
  

  getFriendInfo(friendId: string) {
    this.userService.getUserProfile(friendId)
      .subscribe(
        (resp: any) => {
          // Process friend info here
          console.log('Friend info:', resp);
        },
        err => {
          this.toastService.presentStdToastr('Error fetching friend info');
        }
      );
  }

  checkMessageExisting(message) {
    return this.messages.find(msg => msg.id == message._id) ? true : false;
  }

  initSocketListeners() {
    if (!this.socket) {
      console.error("❌ WebSocket not initialized.");
      return;
    }
    if (this.listenersBound) return;  // already bound once, don't rebind
    this.listenersBound = true;
  
    // helper to normalize any message payload
    const normalize = (m: any): Message => {
      const copy: any = { ...m };
      copy.id = copy.id || copy._id || `${copy.from}-${copy.to}-${copy.createdAt || Date.now()}`;
      copy.createdAt = copy.createdAt ? new Date(copy.createdAt) : new Date();
      if (copy.image && typeof copy.image === 'object' && copy.image.path) {
        copy.image = copy.image.path;
      }
      return new Message().initialize(copy);
    };
  
    this.socket.on('new-message', (raw: any) => {
      this.zone.run(() => {
        try {
          if (typeof raw === 'string') raw = JSON.parse(raw);
          const msg = normalize(raw);
  
          // (optional) only show messages for this thread
          if (this.user && (msg.from === this.user.id || msg.to === this.user.id)) {
            // ✅ ensure server/client know it’s read
            this.markThreadRead();
          }
            
          if (this.messages.some(m => m.id === msg.id)) return; // dedupe
  
          this.messages.push(msg);
          this.groupMessagesByDate();
          this.scrollToBottom();
        } catch (e) {
          console.error('Failed to process incoming message:', e, raw);
        }
      });
    });
  
    this.socket.on('message-sent', (saved: any) => {
      this.zone.run(() => {
        const msg = normalize({ ...saved, id: saved._id || saved.id, state: 'sent' });
        const i = this.messages.findIndex(m => m.id === msg.id);
        if (i !== -1) this.messages[i] = msg;
        else this.messages.push(msg);
        this.groupMessagesByDate();
      });
    });
  
    this.socket.on('user-status-changed', (data: any) => {
      this.zone.run(() => {
        const userId = data?.userId ?? data?.user?.id ?? data?.id;
        if (userId && this.user?.id === userId) {
          this.user.online = !!data.online;
          // reassign to trigger change detection in some templates
          this.user = Object.assign(new User(), this.user);
          this.changeDetection.detectChanges();
        }
      });
    });
  
    this.socket.on('incoming-video-call', (data: any) => {
      this.zone.run(() => {
        const msg = normalize({
          id: data.messageId,
          from: data.from,
          to: data.to,
          text: data.text,
          type: 'video-call-request',
          createdAt: new Date(),
          state: 'sent'
        });
        this.handleIncomingVideoCall(msg);
      });
    });
  }
  
  
  private handleIncomingVideoCall(message: Message) {
    if (message.from === this.authUser.id) {
      console.log("Ignoring own video call request");
      return;
    }
  
    this.messages.push(new Message().initialize(message));
    this.groupMessagesByDate();
    this.scrollToBottom();
  }
  
  
  private async showVideoCallAlert(message: Message) {
    const alert = await this.alertController.create({
      header: 'Video Call Request',
      message: message.text,
      buttons: [
        {
          text: 'Decline',
          handler: () => {
            this.declineVideoCall(message);
          }
        },
        {
          text: 'Accept',
          handler: () => {
            this.acceptVideoCall(message);
            this.router.navigate(['/messages/video', message.from]);
          }
        }
      ]
    });
    await alert.present();
  }
  
  
  

  resendMessage(message) {
    this.resend.push(message.id);
    this.sendMessage(message);
  }

  getChatPermission() {
    return new Promise((resolve, reject) => {
      this.messageService.getPermission(this.user.id)
        .then(
          (resp: any) => {
            if (resp.data) {
              resolve(true); // Permission granted
            } else {
              // Assuming the response includes details about how many chats have been used and the daily limit
              const usedChats = resp.data.usedChats || 0;
              const totalChats = resp.data.totalChats || 3; // Assuming 3 is the daily free chat limit
              this.showSubscriptionAlert(usedChats, totalChats); // Show the alert with details
              reject(false);
            }
          },
          err => {
            this.toastService.presentStdToastr(err);
            reject(false);
          }
        );
    });
}


async showSubscriptionAlert(usedChats = 0, totalChats = 3) {
  const remainingChats = totalChats - usedChats;
  const alert = await this.alertController.create({
    header: 'Free Chat Limit Reached',
    message: `You have used ${usedChats} out of ${totalChats} free chats today. Subscribe for unlimited chats.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Subscribe Now',
        cssClass: 'text-danger',
        handler: () => this.router.navigateByUrl('/tabs/subscription'),
      }
    ]
  });

  await alert.present();
}


private async compressImage(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
}

private async uploadImageAndGetUrl(): Promise<string> {
  try {
    if (!this.imageFile?.file) return null;

    const uploadResponse = await this.uploadFileService.upload(this.imageFile.file, this.authUser.id)
      .pipe(take(1))
      .toPromise();

    return uploadResponse?.fileUrl || null;
  } catch (error) {
    console.error('Image upload failed:', error);
    this.toastService.presentStdToastr('Failed to upload image');
    return null;
  }
}



private dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

private dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

sanitizeImageUrl(url: string): SafeUrl {
  return this.sanitizer.bypassSecurityTrustUrl(url);
}


async sendMessage(message: any /*, ind?: number */): Promise<boolean> {
  // Build final payload (trust message.image which was uploaded in addMessage)
  const payload = {
    id: message.id,
    from: this.authUser.id,
    to: this.user.id,
    text: message.text ?? '',
    state: 'sending',
    image: message.image ?? null,
    type: message.type || (this.productId ? 'product' : 'friend'),
    productId: message.productId ?? this.productId ?? null,
    createdAt: message.createdAt || new Date(),
  };

  // Update local temp message immediately
  const idx = this.messages.findIndex(m => m.id === message.id);
  if (idx !== -1) {
    this.messages[idx] = new Message().initialize(payload);
    this.groupMessagesByDate();
  }

  // Queue-safe emit (works even if socket reconnects)
  SocketService.emit('send-message', payload);

  return true;
}






async addMessage() {
  if (!this.messageText && !this.image) return;

  if (!this.conversationStarted() && this.messages.length > 0) {
    this.messageText = "";
    return;
  }

  try {
    await this.getChatPermission();

    const tempId = Date.now().toString();
    
    // ✅ STEP 1: Upload the image FIRST
    let imageUrl = null;
    if (this.imageFile?.file) {
      imageUrl = await this.uploadImageAndGetUrl();
      if (!imageUrl) return;
    }

    // ✅ STEP 2: Create final message with real image URL
    const message = {
      id: tempId,
      from: this.authUser.id,
      to: this.user.id,
      text: this.messageText,
      state: 'sent',
      image: imageUrl,  // Now it’s a string URL, not SafeUrl
      type: this.productId ? 'product' : 'friend',
      productId: this.productId || null,
      createdAt: new Date()
    };

    // ✅ STEP 3: Show message immediately in chat
    this.messages.push(new Message().initialize(message));
    this.groupMessagesByDate();
    this.scrollToBottom();

    // ✅ STEP 4: Send message via socket
    const sendSuccess = await this.sendMessage(message);
    if (sendSuccess) {
      // ✅ STEP 5: Clear form
      this.messageText = "";
      this.image = null;
      this.imageFile = null;
    }

  } catch (err) {
    if (err) this.router.navigate(['/tabs/subscription']);
  }
}


removeImage() {
  this.image = null;
  this.imageFile = null;
}


async pickMedia(mediaType: 'image' | 'video') {
  try {
    if (this.platform.is('cordova')) {
      const sourceType = this.camera.PictureSourceType.CAMERA;
      const mediaTypeValue = mediaType === 'image' ? this.camera.MediaType.PICTURE : this.camera.MediaType.VIDEO;

      const options = {
        quality: 75,
        destinationType: this.camera.DestinationType.FILE_URI,
        mediaType: mediaTypeValue,
        sourceType: sourceType,
        saveToPhotoAlbum: false,
        correctOrientation: true,
      };

      const fileUri = await this.camera.getPicture(options);
      const nativePath = await this.filePath.resolveNativePath(fileUri);
      const fileEntry = await this.file.resolveLocalFilesystemUrl(nativePath) as FileEntry;

      fileEntry.file(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const blob = new Blob([reader.result], { type: file.type });
          const newFile = new File([blob], file.name, { type: file.type });
          this.imageFile = { file: newFile, imageData: nativePath };
          this.image = this.webView.convertFileSrc(nativePath);
        };
        reader.readAsArrayBuffer(file);
      });

    } else {
      // Browser fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = mediaType === 'image' ? 'image/*' : 'video/*';
      input.onchange = () => {
        const file = input.files[0];
        if (file) {
          const objectUrl = URL.createObjectURL(file);
          this.imageFile = { file, imageData: objectUrl };
          this.image = this.sanitizeImageUrl(objectUrl) as string;
          
        }
      };
      input.click();
    }

  } catch (err) {
    console.error('Error capturing media:', err);
    this.toastService.presentStdToastr('Failed to capture media');
  }
}




// Helper function to convert base64 into File object
private convertBase64ToFile(base64String: string, filename: string): File {
  const arr = base64String.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new File([u8arr], filename, { type: mime });
}



allowToShowDate(ind: number): boolean {
  if (ind === 0) return true;

  const toYMD = (d: any) => {
    const dt = new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${m}-${day}`;
  };

  return toYMD(this.messages[ind].createdAt) !== toYMD(this.messages[ind - 1].createdAt);
}


  conversationStarted() {
    return (this.allowToChat || (this.messages && (this.messages.length <= 1 || this.messages.filter(msg => !msg.isMine(this.authUser.id)).length > 0)));
  }

// Modify ProfileEnabled to always return true
ProfileEnabled() {
  return true;  // Allow profile viewing without restrictions
}

showUserProfile() {
  // Since ProfileEnabled now always returns true, you don't need the else case anymore
  this.router.navigateByUrl('/tabs/profile/display/' + this.user.id);
}

showUproduct() {
  // Since ProfileEnabled now always returns true, you don't need the else case anymore
  this.router.navigateByUrl('/tabs/buy-and-sell/product/' + this.productId);
}





  async lockedProfileAlert() {
    const alert = await this.alertController.create({
      header: 'Not Allowed',
      message: 'You can only access the profile after ' + this.user.fullName + ' respond to your messages',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  getProductImage(product: Product): string {
    if (product.photos && product.photos.length > 0) {
      console.log("imageeeeerrrrrrrrrrrrrrrrreeeeee",product.photos[0].url);
      return product.photos[0].url; // Return the URL of the first photo
    } else {
      return 'assets/imgs/no-image.png'; // Placeholder image if no photos exist
    }
  }

  videoCall() {
    if (this.authUser  && this.user) {
      this.router.navigateByUrl('/messages/video/' + this.user.id);
    } else this.videoCallSubAlert();
  }
  
  async videoCallSubAlert() {
    const message = !this.user.friend ? ('You can only call friends, how about sending a friend request to ' + this.user.fullName) : ('You must subscribe to call ' + this.user.fullName);
    const alert = await this.alertController.create({
      header: 'You can\'t call ' + this.user.fullName,
      message: message,
      buttons: [
        {
          text: 'cancel',
          role: 'cancel'
        },
        {
          text: 'Subscribe',
          cssClass: 'text-danger',
          handler: () => {
            this.router.navigateByUrl('/tabs/subscription');
          }
        }
      ]
    });
    await alert.present();
  }

  nonFriendsChatEnabled() {
   // console.log('Friend status:', this.user?.isFriend);
   // console.log('Messages count:', this.messages.length);
  
    if (this.user && this.user.isFriend) {
      return true; // No limit for friends
    }
    
    return this.messages.length < 10; // Limit for non-friends
  }
  
  async requestVideoCall() {
    // Ensure conversation is started and the user can still send messages (if non-friend)
    if (!this.conversationStarted() || !this.nonFriendsChatEnabled()) {
      console.log("Cannot request video call: conversation not started or message limit reached.");
      this.toastService.presentStdToastr('Please start a conversation first');
      return;
    }
  
    if (!this.authUser || !this.user) {
      console.log("Missing user information.");
      return;
    }
  
    // Ensure the socket is initialized
    if (!this.socket) {
      console.warn("⚠️ WebSocket is not ready. Trying to reinitialize...");
      if (this.user?.id) {
        await this.initializeSocket();
      } else {
        console.error("❌ Cannot reinitialize WebSocket: User ID missing.");
        return;
      }
    }
  
    const alert = await this.alertController.create({
      header: 'Request Video Call',
      message: `Do you want to request a video call with ${this.user.fullName}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Request',
          handler: () => this.sendVideoCallRequest()
        }
      ]
    });
  
    await alert.present();
  }
  
private async sendVideoCallRequest() {
  const videoCallMessage = new Message();
  videoCallMessage.id = this.index.toString();
  videoCallMessage.from = this.authUser.id;
  videoCallMessage.to = this.user.id;
  videoCallMessage.text = `${this.authUser.fullName} has requested a video call.`;
  videoCallMessage.state = 'sending';
  videoCallMessage.createdAt = new Date();
  videoCallMessage.type = 'video-call-request';

  this.messages.push(new Message().initialize(videoCallMessage));
  this.groupMessagesByDate();
  this.scrollToBottom();

  const payload = {
    from: this.authUser.id,
    to: this.user.id,
    text: videoCallMessage.text,
    messageId: videoCallMessage.id,
  };

  if (this.socket?.connected) {
    // keep ack when possible
    this.socket.emit('video-call-request', payload, (ack) => {
      if (ack?.success) {
        const i = this.messages.findIndex(m => m.id === videoCallMessage.id);
        if (i !== -1) {
          this.messages[i].state = 'sent';
          this.groupMessagesByDate();
        }
      } else {
        console.error('Video call request failed:', ack?.error);
      }
    });
  } else {
    // offline-safe emit (no ack)
    SocketService.emit('video-call-request', payload);
  }

  this.index++;
}


  
  
canRequestVideoCall(): boolean {
  if (!this.user) return false;
  if (this.user.isFriend) return true;  // Always allow friends
  if (this.videoCallDeclined) return false;  // Block after declined
  return true;  // Allow if not declined
}

  
  
  
}
