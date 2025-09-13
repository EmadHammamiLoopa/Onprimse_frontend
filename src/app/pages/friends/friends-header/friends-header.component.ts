import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AppEventsService } from 'src/app/services/app-events.service';

@Component({
  selector: 'app-friends-header',
  templateUrl: './friends-header.component.html',
  styleUrls: ['./friends-header.component.scss'],
})
export class FriendsHeaderComponent implements OnInit {
  messagesCount$: Observable<number>;
  friendRequestsCount$: Observable<number>;

  constructor(private appEvents: AppEventsService) {}

  ngOnInit() {
    this.messagesCount$ = this.appEvents.badge$('messages');
    this.friendRequestsCount$ = this.appEvents.badge$('friends');
  }
}
