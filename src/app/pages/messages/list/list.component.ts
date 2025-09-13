import { MessageService } from './../../../services/message.service';
import { User } from './../../../models/User';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { AlertButton, AlertController } from '@ionic/angular';
import { UserService } from 'src/app/services/user.service';
import { WebrtcService } from 'src/app/services/webrtc.service';
import { Router } from '@angular/router';
import { AppEventsService } from 'src/app/services/app-events.service';
import { Message } from 'src/app/models/Message';
import { SocketService } from 'src/app/services/socket.service';

interface ListUser extends User {
  hasUnread?: boolean;
}

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})



export class ListComponent implements OnInit, OnDestroy {
  page = 0;
  pageLoading = false;
  users: ListUser[] = [];   // ✅ now template knows hasUnread exists
  missedCalls = [];
  private socket: any;                   
  private listenersBound = false;        
  private authId: string | null = null;  
  private static READ_KEY = 'chatLastReadAt';
  private lastReadAt: Record<string, number> = {};
  private prevMissedCount = 0;

  constructor(
    private messageService: MessageService,
    private alertController: AlertController,
    private userService: UserService,
    private webrtcService: WebrtcService,
    private router: Router,
    private badges: AppEventsService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Only subscribe
    this.webrtcService.missedCalls$.subscribe((calls) => {
      this.zone.run(() => {
        this.missedCalls = calls;
  
        if (calls.length > this.prevMissedCount) {
          const m = calls[0];
          this.presentMissedCallAlert(m.userId, m.userName, m.timestamp);
        }
  
        this.prevMissedCount = calls.length;
        this.cdr.detectChanges(); // or this.cdr.markForCheck() if OnPush
      });
    });

    try {
      const raw = localStorage.getItem('user');
      this.authId = raw ? JSON.parse(raw)?._id || JSON.parse(raw)?.id : null;
    } catch {}
    this.loadLastReadMap();

    // ✅ socket live updates for list
    this.initSocket();
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.off('new-message');
      this.socket.off('video-call-cancelled');
      this.socket.off('video-call-timeout');
      this.socket.off('missed-call');
    
    }
  }

  private keyOf = (idOrUser: any) =>
    String(typeof idOrUser === 'object' ? (idOrUser._id || idOrUser.id) : idOrUser);

  
  async initSocket() {
    await SocketService.initializeSocket();          // ✅ static
    this.socket = await SocketService.getSocket();   // ✅ static
  
    if (!this.listenersBound) {
      this.bindSocketListeners();
      this.listenersBound = true;
    }
  }

  private bindSocketListeners() {
    if (!this.socket) return;
  
    // prevent double-binding on hot reload / re-enter
    this.socket.off('new-message');
    this.socket.off('video-call-cancelled');
  this.socket.off('video-call-timeout'); // if your server emits this
  this.socket.off('missed-call');        // if your server emits this


    this.socket.on('new-message', (raw: any) => {
      this.zone.run(() => {
        try {
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
          const normalized = new Message().initialize({
            id: msg.id || msg._id,
            from: msg.from,
            to: msg.to,
            text: msg.text ?? '',
            image: msg.image ?? null,
            type: msg.type ?? 'friend',
            productId: msg.productId ?? null,
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
            state: msg.state ?? 'sent',
          });
  
          // determine peer row (the other user)
          const peerId = (this.authId && normalized.from === this.authId)
            ? normalized.to
            : normalized.from;
  
          const peerKey = this.keyOf(peerId);
          const isIncoming = !this.authId || normalized.from !== this.authId;
  
          // ✅ compute unread using local last-read map
          const shouldHighlight = this.isUnread(peerKey, normalized, isIncoming);
  
          // if row exists, update & move to top
          const existingIdx = this.users.findIndex(u => this.keyOf(u) === peerKey);
          if (existingIdx !== -1) {
            const user = this.users[existingIdx];
            user.messages = [normalized, ...(user.messages || [])];
            user.hasUnread = shouldHighlight;
  
            const [moved] = this.users.splice(existingIdx, 1);
            this.users.unshift(moved);
  
            this.sortUsersByLatestMessage();
            this.cdr.markForCheck();
            return;
          }

          
  
          // else fetch profile and insert (with race guard)
          this.userService.getUserProfile(peerId).subscribe((profile: any) => {
            const idx2 = this.users.findIndex(u => this.keyOf(u) === peerKey);
            if (idx2 !== -1) {
              const user = this.users[idx2];
              user.messages = [normalized, ...(user.messages || [])];
              user.hasUnread = shouldHighlight;
  
              const [moved] = this.users.splice(idx2, 1);
              this.users.unshift(moved);
            } else {
              const user = new User().initialize({
                ...profile,
                _id: peerKey,
                id: peerKey,
                messages: [normalized],
              }) as ListUser;
  
              user.hasUnread = shouldHighlight;
              this.users.unshift(user);
            }
  
            this.sortUsersByLatestMessage();
            this.cdr.markForCheck();
          });
        } catch (e) {
          console.error('list/new-message error', e, raw);
        }
      });
    });

    
  
  }
  
  
  ionViewWillEnter() {
    this.badges.reset('messages');
    this.page = 0;
    this.getUsersMessages(null, true);  // ✅ refresh = true
  }

  trackByUserId = (_: number, u: ListUser) => (u._id || u.id);


  private loadLastReadMap() {
  try {
    this.lastReadAt = JSON.parse(localStorage.getItem(ListComponent.READ_KEY) || '{}');
  } catch {
    this.lastReadAt = {};
  }
}


private async presentMissedCallAlert(callerId: string, callerName: string, atISO: string) {
  const alert = await this.alertController.create({
    header: 'Missed call',
    message: `${callerName || 'Unknown'} tried to call you ${this.formatTimeAgo(atISO)}.`,
    buttons: [
      { text: 'Call back', handler: () => this.callBack(callerId) },
      { text: 'Dismiss', role: 'cancel' }
    ]
  });
  await alert.present();
}

private markLocallyRead(peerKey: string) {
  this.lastReadAt[peerKey] = Date.now();
  localStorage.setItem(ListComponent.READ_KEY, JSON.stringify(this.lastReadAt));
}

private isUnread(peerKey: string, lastMsg: Message, isIncoming: boolean): boolean {
  if (!lastMsg) return false;
  // If server gives unreadCount, prefer it (handled below). Otherwise use local last-read.
  const lastTs = new Date(lastMsg.createdAt).getTime();
  const readTs = this.lastReadAt[peerKey] || 0;
  return isIncoming && lastTs > readTs;
}
  
  /** ✅ Show Missed Calls */
// Update the showMissedCalls method in list.component.ts
async showMissedCalls() {
  const missedCalls = this.webrtcService.getMissedCalls();
  
  if (missedCalls.length === 0) {
    const alert = await this.alertController.create({
      header: 'No Missed Calls',
      message: 'You have no missed video calls.',
      buttons: ['OK']
    });
    await alert.present();
    return;
  }

  const buttons: AlertButton[] = [
    ...missedCalls.map(call => {
      const formattedTime = this.formatTimeAgo(call.timestamp);
      return {
        text: `${call.userName} (${formattedTime})`,
        handler: () => this.callBack(call.userId)
      } as AlertButton;
    }),
    {
      text: 'Clear All',
      role: 'destructive',
      handler: () => this.webrtcService.clearMissedCalls()
    },
    {
      text: 'Cancel',
      role: 'cancel'
    }
  ];

  const alert = await this.alertController.create({
    header: 'Missed Calls',
    message: `You have ${missedCalls.length} missed call(s)`,
    buttons
  });

  await alert.present();
}


// Add this helper method
private formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const callTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - callTime.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}
  
  
  
  // ✅ Helper method to show remaining missed calls
  async showRemainingMissedCalls(remainingCalls: any[]) {
    const buttons: any[] = remainingCalls.map(call => ({
      text: `📞  ${call.userId} (${new Date(call.timestamp).toLocaleTimeString()})`,
      handler: () => {
        this.callBack(call.userId);
      }
    }));
  
    buttons.push({
      text: "Close",
      role: "cancel",
      handler: () => {
        this.webrtcService.clearMissedCalls();
      }
    });
  
    const alertElement = await this.alertController.create({
      header: "📞 More Missed Calls",
      message: `You have ${remainingCalls.length} more missed calls.`,
      buttons: buttons
    });
  
    await alertElement.present();
  }
  
  

  getUsersMessages(event?, refresh?) {
    if (!event) this.pageLoading = true;
    if (refresh) this.page = 0;

    this.messageService.usersMessages(this.page++).then(
      (resp: any) => {
        this.pageLoading = false;
        if (refresh) this.users = [];

        resp.data.users.forEach((usr) => {
          if (usr.messages && usr.messages.length > 0) {
            this.userService.getUserProfile(usr._id).subscribe((userProfile) => {
              const messages = usr.messages.map((message) =>
                new Message().initialize({
                  ...message,
                  createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
                  productId: message.type === 'product' ? message.productId : message.productId ?? null,
                })
              );
            
              const uid = this.keyOf(usr._id);
              const user = new User().initialize({
                ...userProfile,
                _id: uid,
                id: uid,
                messages,
                firstName: userProfile.firstName || usr.firstName,
                lastName: userProfile.lastName || usr.lastName,
                mainAvatar: userProfile.mainAvatar || usr.mainAvatar,
                avatar: userProfile.avatar?.length ? userProfile.avatar : usr.avatar,
              }) as ListUser;
            
              const last = messages?.[0];
              const isIncoming = !!last && this.authId && last.from !== this.authId;
              const hasServerUnread = Number.isFinite(usr.unreadCount);
              
              // ✅ prefer server unreadCount if provided, else fallback to local last-read logic
              user.hasUnread = hasServerUnread
                ? (usr.unreadCount > 0)
                : this.isUnread(uid, last, isIncoming);
                
              // ✅ replace-or-insert (dedupe)
              const idx = this.users.findIndex(u => this.keyOf(u) === uid);
              if (idx !== -1) {
                this.users[idx] = user;
                const [moved] = this.users.splice(idx, 1);
                this.users.unshift(moved);
              } else {
                this.users.unshift(user);
              }
            
              this.sortUsersByLatestMessage();
              this.cdr.markForCheck();
            });
            
          }
        });

        if (event) {
          event.target.complete();
          if (!resp.data.more && !refresh) event.target.disabled = true;
        }
      },
      (err) => {
        this.pageLoading = false;
        if (event) event.target.complete();
        console.log(err);
      }
    );
  }

  private isValidObjectId(id: string) { return /^[a-f\d]{24}$/i.test(id); }

  callBack(userId: string) {
    if (!this.isValidObjectId(userId)) {
      console.warn('Invalid userId for callback:', userId);
      return;
    }
    // Make sure no stale caller remains from a previous ring
    localStorage.removeItem('partnerId');
    this.router.navigate(['/messages/video', userId], { queryParams: { answer: false } });
  }
  

openThread(user: User) {
  (user as any).hasUnread = false;
  const peerKey = String(user._id || user.id);
  this.markLocallyRead(peerKey);  

  // notify backend (optional, aligns with your ChatComponent)
  try {
    if (this.socket) {
      this.socket.emit('mark-thread-read', { peerId: user._id || user.id });
    }
  } catch {}

  const last = user.messages?.[0];
  const productId = last?.type === 'product' ? last?.productId : null;

  this.router.navigate(['/messages/chat', user.id], {
    queryParams: { productId }
  });
}

  // Sort users by the latest message timestamp (newest first)
  sortUsersByLatestMessage() {
    this.users.sort((a, b) => {
      const aTs = a.messages?.length ? new Date(a.messages[0].createdAt).getTime() : 0;
      const bTs = b.messages?.length ? new Date(b.messages[0].createdAt).getTime() : 0;
      return bTs - aTs;
    });
  }


  // Remove a user and their messages
  async removeUser(user: User) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete the conversation with ${user.fullName}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: () => {
            // Delete all messages for the user
            user.messages.forEach((message) => {
              this.messageService.deleteMessage(message.id).then(() => {
                console.log('Message deleted:', message.id);
              });
            });

            // Remove the user from the local list
            this.users = this.users.filter((u) => u._id !== user._id);
          },
        },
      ],
    });

    await alert.present();
  }
}