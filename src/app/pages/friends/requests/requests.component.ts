import { Component, OnInit, OnDestroy } from '@angular/core';
import { RequestService } from 'src/app/services/request.service';
import { UserService } from 'src/app/services/user.service';
import { ToastService } from 'src/app/services/toast.service';
import { Request } from 'src/app/models/Request';
import { User } from 'src/app/models/User';
import { AlertController } from '@ionic/angular';
import { AppEventsService } from 'src/app/services/app-events.service';
import { SocketService } from 'src/app/services/socket.service';
import { Socket } from 'socket.io-client';
import { NgZone } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.component.html',
  styleUrls: ['./requests.component.scss'],
})
export class RequestsComponent implements OnInit, OnDestroy {
  requests: Request[] = [];
  pageLoading = false;
  page: number = 0;
  private socket: Socket | null = null;
  private badgeSubscription!: Subscription;
  private friendRequestCount = 0;

  constructor(
    private requestService: RequestService,
    private userService: UserService,
    private toastService: ToastService,
    private alertCtrl: AlertController,
    private appEvents: AppEventsService,
    private zone: NgZone
  ) {}

  async ngOnInit() {
    // Subscribe to friend request count changes
    this.badgeSubscription = this.appEvents.badge$('friends').subscribe(count => {
      this.friendRequestCount = count;
      this.updatePageTitle();
    });

    // Ensure socket is properly initialized
    try {
      SocketService.bindToAuthUser();
      await SocketService.initializeSocket();
      await SocketService.ensureConnected();
      this.socket = await SocketService.getSocket();
      
      // Listen for friend request events to update title
      this.setupSocketListeners();
    } catch (error) {
      console.error('Socket initialization error in requests:', error);
    }
    
    this.loadRequests();
  }

  ionViewWillEnter() {
    this.page = 0;
    this.loadRequests();
    this.updatePageTitle(); // Update title when entering page
  }

  ionViewWillLeave() {
    // Reset title when leaving the page
    this.resetPageTitle();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    if (this.badgeSubscription) {
      this.badgeSubscription.unsubscribe();
    }
    
    // Remove socket listeners
    if (this.socket) {
      this.socket.off('new-friend-request');
      this.socket.off('friend-requests-updated');
      this.socket.off('friend-request-accepted');
      this.socket.off('friend-request-declined');
    }
    
    // Reset title when component is destroyed
    this.resetPageTitle();
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    // Listen for new friend requests
    this.socket.on('new-friend-request', (data: any) => {
      this.zone.run(() => {
        console.log('New friend request received in RequestsComponent');
        this.updatePageTitle();
      });
    });

    // Listen for friend request updates
    this.socket.on('friend-requests-updated', (data: any) => {
      this.zone.run(() => {
        console.log('Friend requests updated in RequestsComponent');
        this.updatePageTitle();
      });
    });

    // Listen for friend request acceptance
    this.socket.on('friend-request-accepted', (data: any) => {
      this.zone.run(() => {
        console.log('Friend request accepted in RequestsComponent');
        this.updatePageTitle();
      });
    });

    // Listen for friend request decline
    this.socket.on('friend-request-declined', (data: any) => {
      this.zone.run(() => {
        console.log('Friend request declined in RequestsComponent');
        this.updatePageTitle();
      });
    });
  }

  private updatePageTitle() {
    if (this.friendRequestCount > 0) {
      document.title = `(${this.friendRequestCount}) Friend Requests`;
    } else {
      document.title = 'Friend Requests';
    }
  }

  private resetPageTitle() {
    // Reset to your app's default title
    document.title = 'Your App Name'; // Replace with your actual app name
  }

  loadRequests(event?: any) {
    this.pageLoading = true;
    this.getRequests(this.page, event);
  }

  getRequests(page: number = this.page, event?: any) {
    this.requestService.requests(page).then(
      (resp: any) => {
        if (!event) {
          this.requests = [];
        }

        this.requests = [
          ...this.requests,
          ...resp.data.map((requestData: any) => {
            const request = new Request().initialize(requestData);
            request.from = new User().initialize({
              ...requestData.from,
              mainAvatar: requestData.from.mainAvatar || requestData.from.avatar?.[0],
            });
            return request;
          }),
        ];

        // Update the badge when we load page 0
        if (page === 0) {
          const count = Array.isArray(resp?.data) ? resp.data.length : 0;
          this.appEvents.set('friends', count);
          this.friendRequestCount = count; // Update local count
          this.updatePageTitle(); // Update page title
        }

        if (event?.target) event.target.complete();
        this.pageLoading = false;
      },
      (err) => {
        this.pageLoading = false;
        console.error('Error loading requests:', err);
        this.toastService.presentStdToastr('Failed to load requests.');
        if (event?.target) event.target.complete();
      }
    );
  }

  async acceptRequest(request: Request) {
    const requestId = request._id;
    try {
      const resp: any = await this.requestService.acceptRequest(requestId);

      // Remove from list immediately
      this.requests = this.requests.filter((r) => r._id !== requestId);
      this.toastService.presentStdToastr(resp.message);

      // Instant badge change (optimistic)
      this.appEvents.inc('friends', -1);
      this.friendRequestCount = Math.max(0, this.friendRequestCount - 1); // Update local count
      this.updatePageTitle(); // Update page title

      // Refresh friends list
      await this.userService.refreshFriendsList();
      
      // Emit socket event to notify other clients
      SocketService.emit('friend-request-accepted', { requestId });
      
    } catch (err) {
      console.error('Error accepting request:', err);
      this.toastService.presentStdToastr('Failed to accept request.');
    }
  }

  async rejectRequestConf(request: Request) {
    const alert = await this.alertCtrl.create({
      header: 'Reject request',
      message: 'Do you really want to reject this request?',
      buttons: [
        { text: 'CANCEL', role: 'cancel' },
        { text: 'REJECT', cssClass: 'text-danger', handler: () => this.rejectRequest(request) },
      ],
    });
    await alert.present();
  }

  async rejectRequest(request: Request) {
    const requestId = request._id;
    try {
      const resp: any = await this.requestService.cancelRequest(requestId);

      // Remove from list immediately
      this.requests = this.requests.filter((r) => r._id !== requestId);
      this.toastService.presentStdToastr(resp.message);

      // Instant badge change (optimistic)
      this.appEvents.inc('friends', -1);
      this.friendRequestCount = Math.max(0, this.friendRequestCount - 1); // Update local count
      this.updatePageTitle(); // Update page title

      // Emit socket event to notify other clients
      SocketService.emit('friend-request-declined', { requestId });
      
    } catch (err) {
      console.error('Error rejecting request:', err);
      this.toastService.presentStdToastr('Failed to reject request.');
    }
  }
}