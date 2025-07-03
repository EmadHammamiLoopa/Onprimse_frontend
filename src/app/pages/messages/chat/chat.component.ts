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

interface ImageFileObject {
  file: File;
  imageData: string;
}

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
              private filePath: FilePath,
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
        this.initializeSocket(userId); // Pass userId directly

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
    // Emit accept event
    this.socket.emit('video-call-accepted', {
      from: this.authUser.id,
      to: message.from,
      messageId: message.id
    });
  
    this.user.isFriend = true;  // Now enable video button!
  }
  
  declineVideoCall(message: Message) {
    this.socket.emit('video-call-declined', {
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
    this.router.navigate(['/login']);
  }

  getUserId() {
    if (this.authUser && this.authUser._id) {
      this.route.paramMap.subscribe(params => {
        const id = params.get('id');
        if (id && this.authUser._id !== id) {
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
    if (!userId) {
      this.pageLoading = false;
      return;
    }
    console.log('Fetching profile for user ID:', userId);
    this.userService.getUserProfile(userId)
      .subscribe(
        (resp: any) => {
          if (resp && resp.data) {
            this.user = new User().initialize(resp.data);
            console.log("Recipient user data fetched and stored:", this.user);
            this.getMessages(null);
          } else if (resp) {
            this.user = new User().initialize(resp);
            console.log("Recipient user data fetched and stored:", this.user);
            this.getMessages(null);
          } else {
            this.pageLoading = false;
            console.error('User profile data is undefined or null');
            this.toastService.presentStdToastr('Sorry, this user is not available');
            this.location.back();
          }
        },
        err => {
          this.pageLoading = false;
          console.error('Error fetching user profile:', err);
          this.toastService.presentStdToastr('Sorry, this user is not available');
          this.location.back();
        }
      );
  }
  
  
  
async initializeSocket(userId: string) {
  if (!userId) {
    console.error("❌ User ID missing");
    return;
  }

  try {
    await SocketService.initializeSocket();
    this.socket = await SocketService.getSocket();
    
    // Only register user if not already connected
    if (!this.socket.connected) {
      console.warn("⚠️ Socket not connected, reinitializing...");
      await SocketService.initializeSocket();
    }

    // Register user with the server
    SocketService.registerUser(userId);
    
    // Initialize listeners
    this.initSocketListeners();
    
  } catch (error) {
    console.error("❌ Socket initialization failed:", error);
    // Retry after delay
    setTimeout(() => this.initializeSocket(userId), 5000);
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
        await this.initializeSocket(this.user.id);
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
      console.error("❌ WebSocket not initialized. Cannot listen for messages.");
      return;
    }
  
    this.socket.on('new-message', (message) => {
      console.log("📩 New message received from WebSocket:", message);
  
      if (typeof message === "string") {
        message = JSON.parse(message);
      }
  
      // Check if this is a duplicate message
      const isDuplicate = this.messages.some(m => 
        m.id === message.id || 
        (m.text === message.text && 
         m.from === message.from && 
         Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()) < 1000)
      );
  
      if (isDuplicate) {
        console.log("🔄 Duplicate message detected, ignoring");
        return;
      }
  
      // Handle video call requests
      if (message.type === 'video-call-request') {
        this.handleIncomingVideoCall(message);
        return;
      }
  
      this.messages.push(new Message().initialize(message));
      this.groupMessagesByDate();
      this.scrollToBottom();
    });

    this.socket.on('video-call-accepted', (data) => {
      console.log("✅ Video call accepted:", data);
      this.user.isFriend = true;
      this.toastService.presentStdToastr(`${this.user.fullName} accepted your video call`);
    });
    
    this.socket.on('video-call-declined', (data) => {
      console.log("❌ Video call declined:", data);
      this.toastService.presentStdToastr(`${this.user.fullName} declined your video call`);
    
      // 🔥 HERE: add this line
      if (data.to === this.authUser.id) {
        this.videoCallDeclined = true;
      }
    });
    
    this.socket.on('message-sent', (savedMessage) => {
      console.log("✅ Message sent confirmation received:", savedMessage);
    
      // Normalize _id to id
      savedMessage.id = savedMessage._id;
    
      const index = this.messages.findIndex(m => m.id === savedMessage.id);
      if (index !== -1) {
        this.messages[index] = new Message().initialize({
          ...savedMessage,
          state: 'sent'
        });
        this.groupMessagesByDate();
      } else {
        console.warn("⚠️ Message not found in local list, pushing it manually");
        this.messages.push(new Message().initialize({
          ...savedMessage,
          state: 'sent'
        }));
        this.groupMessagesByDate();
      }
    });
    
    
    this.socket.on('user-status-changed', (data) => {
      console.log("📡 User status changed:", data);
      if (data.userId === this.user.id) {
        this.user.online = data.online;
        this.user = Object.assign(new User(), this.user);
        this.changeDetection.detectChanges();
      }
    });
    
        this.socket.on('incoming-video-call', (data) => {
        console.log("📞 Incoming video call received:", data);

        const message: Message = new Message().initialize({
            id: data.messageId,
            from: data.from,
            to: data.to,
            text: data.text,
            type: 'video-call-request',
            createdAt: new Date(),
            state: 'sent'
        });

        this.handleIncomingVideoCall(message);
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
    this.sendMessage(message, message.id);
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


async sendMessage(message: any, ind: number): Promise<boolean> {
  if (!this.socket) {
    console.warn("⚠️ WebSocket is not ready. Trying to retrieve...");
    this.socket = await SocketService.getSocket();
    if (!this.socket) {
      console.error("❌ WebSocket is still not available. Aborting send.");
      return false;
    }
  }

  let imageUrl = null;
  if (this.imageFile?.file) {
    imageUrl = await this.uploadImageAndGetUrl();
    if (!imageUrl) {
      // Remove the temporary message if upload failed
      const index = this.messages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        this.messages.splice(index, 1);
        this.groupMessagesByDate();
      }
      return false;
    }
  }

  const payload = {
    id: message.id,
    from: this.authUser.id,
    to: this.user.id,
    text: message.text ?? '', // ensures it's always a string
    state: 'sending',
    image: imageUrl || null,
    type: message.type || 'text',
    productId: this.productId || null,
    createdAt: new Date()
  };

  const messageIndex = this.messages.findIndex(m => m.id === message.id);
  if (messageIndex !== -1) {
    this.messages[messageIndex] = new Message().initialize(payload);
    this.groupMessagesByDate();
  }

  this.socket.emit('send-message', payload);

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
      state: 'sending',
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
    const sendSuccess = await this.sendMessage(message, this.index++);
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
    const currDate = {
      year: this.messages[ind].createdAt.toJSON().slice(0, 4),
      month: this.messages[ind].createdAt.toJSON().slice(5, 7),
      day: this.messages[ind].createdAt.toJSON().slice(8, 10)
    };
    if (ind) {
      const lastDate = {
        year: this.messages[ind].createdAt.toJSON().slice(0, 4),
        month: this.messages[ind].createdAt.toJSON().slice(5, 7),
        day: this.messages[ind].createdAt.toJSON().slice(8, 10)
      };

      return currDate.day != lastDate.day || currDate.month != lastDate.month
          || currDate.year != lastDate.year;
    }
    return true;
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
        await this.initializeSocket(this.user.id);
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

    // Add locally
    this.messages.push(new Message().initialize(videoCallMessage));
    this.groupMessagesByDate();
    this.scrollToBottom();

    // Only send what backend expects
    this.socket.emit('video-call-request', {
      from: this.authUser.id,
      to: this.user.id,
      text: videoCallMessage.text,
      messageId: videoCallMessage.id
    }, (ack) => {
      if (ack?.success) {
        const messageIndex = this.messages.findIndex(m => m.id === videoCallMessage.id);
        if (messageIndex !== -1) {
          this.messages[messageIndex].state = 'sent';
          this.groupMessagesByDate();
        }
      } else {
        console.error("Video call request failed:", ack?.error);
      }
    });
    
    this.index++;
}

  
  
canRequestVideoCall(): boolean {
  if (!this.user) return false;
  if (this.user.isFriend) return true;  // Always allow friends
  if (this.videoCallDeclined) return false;  // Block after declined
  return true;  // Allow if not declined
}

  
  
  
}
