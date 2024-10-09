import constants from 'src/app/helpers/constants';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { RequestService } from './../../../services/request.service';
import { ToastService } from './../../../services/toast.service';
import { UserService } from './../../../services/user.service';
import { User } from './../../../models/User';
import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { Request } from 'src/app/models/Request';
import { NativeStorage } from '@ionic-native/native-storage/ngx';

@Component({
  selector: 'app-slide',
  templateUrl: './slide.component.html',
  styleUrls: ['./slide.component.scss'],
})
export class SlideComponent implements OnInit {

  @Input() user: User;
  @Input() authUser: User;
  @Input() random: boolean;
  @Input() last: boolean;

  @Output() onSkip = new EventEmitter();
  @Output() onRefresh = new EventEmitter();

  constructor(private userService: UserService, private requestService: RequestService, private toastService: ToastService,
              private alertCtrl: AlertController, private router: Router, private nativeStorage: NativeStorage) { }

  ngOnInit() {}

  get avatarUrl(): string {
    if (this.user.mainAvatar) {
      return this.user.mainAvatar;
    } else if (this.user.avatar.length > 0) {
      return this.user.avatar[0];
    } else {
      return this.user.gender === 'male' ? constants.defaultMaleAvatarUrl : constants.defaultFemaleAvatarUrl;
    }
  }

  follow() {
    this.userService.follow(this.user.id)
      .subscribe(
        (resp: any) => {
          console.log(resp);
          this.user.followed = resp.data;
          this.toastService.presentStdToastr(resp.message)
        },
        err => {
          console.log(err);
          this.toastService.presentStdToastr(err);
        }
      )
  }

  request() {
    if (this.user.friend) this.removeFriendShipConf();
    else if (this.user.request == 'requesting') this.acceptRequest()
    else if (this.user.request == 'requested') this.cancelRequest()
    else this.requestFriendship()
  }

  handleError(err) {
    this.toastService.presentStdToastr(err)
  }

  acceptRequest() {
    console.log('accept');
    if (this.user.requests && this.user.requests.length > 0) {
      this.requestService.acceptRequest(this.user.requests[0].id)
        .then(
          resp => {
            this.user.friend = true;
          },
          err => this.handleError(err)
        );
    } else {
      console.error('No requests found for user');
    }
  }
  

  cancelRequest() {
    this.requestService.cancelRequest(this.user.requests[0].id)
      .then(
        (resp: any) => {
          this.toastService.presentStdToastr(resp.message)
          this.user.request = null;
          this.user.requests = [];
        },
        err => this.handleError(err)
      )
  }

  requestFriendship() {
    this.requestService.request(this.user.id)
      .then(
        (resp: any) => {
          this.user.friend = false;

          if (typeof resp.data.request == 'string') this.user.request = resp.data.request;
          else {
            this.user.requests.push(new Request(resp.data.request));
            this.user.request = 'requested';
          }
          this.toastService.presentStdToastr(resp.message);
        },
        err => {
          err = JSON.parse(err);
          if (err.code && err.code == constants.ERROR_CODES.SUBSCRIPTION_ERROR) {
            this.router.navigate(['/tabs/subscription']);
            this.toastService.presentStdToastr(err.message)
          }
          else this.handleError(err)
        }
      )
  }

  async removeFriendShipConf() {
    const alert = await this.alertCtrl.create({
      header: 'Remove Friendship',
      message: 'do you really want to remove your friendship ?',
      buttons: [
        {
          text: 'CANCEL',
          role: 'cancel'
        },
        {
          text: 'REMOVE',
          cssClass: 'text-danger',
          handler: () => this.removeFriendship()
        }
      ]
    })
    await alert.present()
  }

  removeFriendship() {
    console.log('remove');
    this.userService.removeFriendship(this.user.id)
      .subscribe(
        (resp: any) => {
          this.toastService.presentStdToastr(resp.message)
          if (resp.data) {
            this.user.friend = false;
            this.user.request = null
          }
        },
        err => this.handleError(err)
      )
  }

  showProfile() {
    this.router.navigateByUrl('/tabs/profile/display/' + this.user.id)
  }

  navigateTo(link) {
    this.router.navigateByUrl(link)
  }

  getVideoCalls() {
    return this.nativeStorage.getItem('videoCalls').then(
      calls => {
        return calls;
      },
      err => {
        return [];
      }
    )
  }

  videoCall() {
    this.getVideoCalls().then(
      calls => {
        if (calls.filter(call => new Date().getTime() - call.date < 24 * 60 * 60 * 1000 && call.id == this.authUser.id).length >= 3) {
          if (!this.authUser || !this.authUser.subscription) {
            return this.videoCallSubAlert();
          }
        }
        this.navigateTo('/messages/video/' + this.user.id)
      }
    )
  }

  async videoCallSubAlert() {
    const alert = await this.alertCtrl.create({
      header: 'You want more calls ?',
      message: 'You have just finished your free calls for today, subscribe and get unlimited calls now !!',
      buttons: [
        {
          text: 'cancel',
          role: 'cancel'
        },
        {
          text: 'Subscribe',
          cssClass: 'text-danger',
          handler: () => {
            this.router.navigateByUrl('/tabs/subscription')
          }
        }
      ]
    })
    await alert.present();
  }
}
