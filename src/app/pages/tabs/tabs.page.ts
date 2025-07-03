import { Component, OnInit, OnDestroy } from '@angular/core';
import { RequestService } from 'src/app/services/request.service';
import { ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { SocketService } from 'src/app/services/socket.service';
import { Socket } from 'socket.io-client';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  newRequestsCount: number = 0;
  private socket: Socket | null = null;
  private routerEventsSub: Subscription;

  tabs: {
    url: string;
    icon?: string;
    iconColor?: string;
    badgeCount?: number;
    notificationEvent?: string;
  }[] = [
    { url: 'profile', icon: 'fas fa-user' },
    { url: 'friends', icon: 'fas fa-users', badgeCount: 0, iconColor: '', notificationEvent: 'new-friend-request' },
    { url: 'messages', icon: 'fas fa-comments', badgeCount: 0, notificationEvent: 'new-message' },
    { url: 'new-friends', icon: 'fas fa-search', badgeCount: 0, notificationEvent: 'friend-suggestion' },
    { url: 'channels', icon: 'fas fa-object-group', badgeCount: 0, notificationEvent: 'new-channel-activity' },
    { url: 'buy-and-sell', icon: 'fas fa-store', badgeCount: 0, notificationEvent: 'new-buy-sell-update' },
    { url: 'small-business', icon: 'fas fa-briefcase', badgeCount: 0, notificationEvent: 'new-business-post' },
  ];

  constructor(
    private requestService: RequestService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit() {
    this.loadNewRequestsCount();
    await this.initializeSocketListeners();

    this.routerEventsSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const activeTab = event.urlAfterRedirects.split('/').pop();
        this.resetTabBadge(activeTab);
      }
    });
  }

  ngOnDestroy() {
    if (this.socket) {
      this.tabs.forEach(tab => {
        if (tab.notificationEvent) {
          this.socket.off(tab.notificationEvent);
        }
      });
    }

    if (this.routerEventsSub) {
      this.routerEventsSub.unsubscribe();
    }
  }

  loadNewRequestsCount() {
    this.requestService.requests(0).then((resp: any) => {
      this.newRequestsCount = resp.data.length;
      this.updateTab('friends', this.newRequestsCount);
    });
  }

  async initializeSocketListeners() {
    try {
      this.socket = await SocketService.getSocket();

      if (!this.socket) {
        console.error("⚠️ WebSocket is not initialized.");
        return;
      }

      this.tabs.forEach(tab => {
        if (tab.notificationEvent) {
          this.socket.on(tab.notificationEvent, () => {
            console.log(`📨 Event received: ${tab.notificationEvent}`);
            if (tab.url === 'friends') {
              this.loadNewRequestsCount(); // get actual number
            } else {
              this.incrementTabBadge(tab.url);
            }
          });
        }
      });
    } catch (error) {
      console.error('⚠️ Failed to initialize WebSocket:', error);
    }
  }

  incrementTabBadge(tabUrl: string) {
    const tab = this.tabs.find(t => t.url === tabUrl);
    if (tab) {
      tab.badgeCount = (tab.badgeCount || 0) + 1;
      tab.iconColor = 'red';
      this.cdr.detectChanges();
    }
  }

  resetTabBadge(tabUrl: string) {
    const tab = this.tabs.find(t => t.url === tabUrl);
    if (tab && tab.badgeCount > 0) {
      tab.badgeCount = 0;
      tab.iconColor = '';
      this.cdr.detectChanges();
    }
  }

  updateTab(tabUrl: string, count: number) {
    const tab = this.tabs.find(t => t.url === tabUrl);
    if (tab) {
      tab.badgeCount = count;
      tab.iconColor = count > 0 ? 'red' : '';
      this.cdr.detectChanges();
    }
  }
}
