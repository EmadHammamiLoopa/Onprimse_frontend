import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from './../../../../services/toast.service';
import { ChannelService } from './../../../../services/channel.service';
import { AlertController, ModalController, PopoverController } from '@ionic/angular';
import { Post } from './../../../../models/Post';
import { User } from './../../../../models/User';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, SimpleChanges, OnChanges, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { DropDownComponent } from 'src/app/pages/drop-down/drop-down.component';
import { Channel } from 'src/app/models/Channel';

@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
})
export class PostComponent implements OnInit, OnChanges {

  @ViewChild('dropdown', { static: false }) dropdown: ElementRef;
  private clickListener: () => void;
  
  @Output() removePost = new EventEmitter();
  @Input() post: Post;
  @Input() user: User;
  @Input() showCommentsBtn = true;
  @Input() channel: Channel;

  isImageEnlarged: boolean = false;
  mediaUrl: string = '';
  cachedStrokeOffset: string = '';
  cachedCircleColor: string = '';
  previousExpiryDate: string | null = null;

  visibilityOptionsOpen = false;
  postId: string;

  deleteLoading = false;

  constructor(
    private alertCtrl: AlertController, 
    private cdr: ChangeDetectorRef,
    private channelService: ChannelService, 
    private toastService: ToastService,
    private modalCtrl: ModalController, 
    private router: Router, 
    private popoverController: PopoverController,
    private renderer: Renderer2,
    private activatedRoute: ActivatedRoute // Inject ActivatedRoute

  ) { }

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params.channel) {
const channelData = typeof params.channel === 'string' ? JSON.parse(params.channel) : params.channel;
        this.channel = new Channel().initialize(channelData);
        if (this.channel.type === 'static_events') {
          // Handle logic specific to static_events channels
          console.log('This is a static_events channel');
        } else if (this.channel.type === 'static') {
          // Handle logic for static channels
          console.log('This is a static channel');
        } else {
          // Handle logic for user-created channels
          console.log('This is a user-created channel');
        }
      }
    });
  this.updateMediaUrl();
  this.checkAndRemoveExpiredMedia(); // Check for expired media

  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['post']) {
      this.updateMediaUrl();
      this.checkAndRemoveExpiredMedia(); // Check for expired media

    }
  }

  postUserName(post: Post) {
    return post.anonymName || `${post.user.firstName} ${post.user.lastName}`;
  }

  updateMediaUrl() {
    this.mediaUrl = this.getMediaUrl(this.post);
  }

  
  getMediaUrl(post: Post): string {
    if (post.media && post.media.url) {
      const baseUrl = 'http://127.0.0.1:3300/';
      const mediaUrl = baseUrl + post.media.url.replace(/\\/g, '/');
      console.log("Generated Media URL:", mediaUrl);  // Debugging output
      return mediaUrl;  // Ensure URL uses forward slashes
    }
    return '';
  }

  toggleImageSize() {
    this.isImageEnlarged = !this.isImageEnlarged;
  }

  getExpirationProgress(expiryDate: string): string {
    if (this.previousExpiryDate === expiryDate && this.cachedStrokeOffset) {
      return this.cachedStrokeOffset;
    }

    const expiryTime = new Date(expiryDate).getTime();
    const currentTime = Date.now();
    const totalTime = expiryTime - new Date(this.post.createdAt).getTime();
    const remainingTime = expiryTime - currentTime;

    const progressPercentage = Math.max((remainingTime / totalTime) * 100, 0);
    const circumference = 282;
    const offset = circumference * (1 - progressPercentage / 100);

    this.cachedStrokeOffset = `stroke-dashoffset: ${offset};`;
    this.previousExpiryDate = expiryDate;
    return this.cachedStrokeOffset;
  }

  getCircleColor(expiryDate: string): string {
    if (this.previousExpiryDate === expiryDate && this.cachedCircleColor) {
      return this.cachedCircleColor;
    }

    const expiryTime = new Date(expiryDate).getTime();
    const currentTime = Date.now();
    const remainingTime = expiryTime - currentTime;

    const oneHour = 60 * 60 * 1000;
    const twentyFourHours = 24 * oneHour;

    let color = 'blue';
    if (remainingTime > oneHour && remainingTime <= twentyFourHours) {
      color = 'blue';
    } else if (remainingTime <= oneHour && remainingTime > 45 * 60 * 1000) {
      color = 'orange';
    } else if (remainingTime <= 45 * 60 * 1000) {
      color = 'red';
    }

    this.cachedCircleColor = color;
    return color;
  }

  getTimeRemaining(expiryDate: string): string {
    const expiryTime = new Date(expiryDate).getTime();
    const currentTime = Date.now();
    const remainingTime = Math.max(expiryTime - currentTime, 0); // Ensure remainingTime is never negative
  
    const minutes = Math.floor(remainingTime / (1000 * 60)) % 60;
    const hours = Math.floor(remainingTime / (1000 * 60 * 60));
  
    return hours > 0 ? `${hours}h` : `${minutes}m`;
  }
  

  checkAndRemoveExpiredMedia() {
    const expiryTime = new Date(this.post.media?.expiryDate).getTime();
    const currentTime = Date.now();
  
    if (expiryTime && expiryTime <= currentTime) {
      this.post.media.url = '';  // Remove the media URL if it has expired
    }
  }

  

  voteOnPost(vote: number) {
    this.channelService.voteOnPost(this.post.id, vote).then(
      (resp: any) => {
        this.post.voted = resp.data.voted;
        this.post.votes = resp.data.votes;
      },
      err => {
        this.toastService.presentStdToastr(err);
      }
    );
  }

  toggleVisibilityOptions(event: Event) {
    event.stopPropagation();
    this.visibilityOptionsOpen = !this.visibilityOptionsOpen;

    if (this.visibilityOptionsOpen) {
      this.addClickListener();
    } else {
      this.removeClickListener();
    }
  }

  private addClickListener() {
    this.clickListener = this.renderer.listen('document', 'click', (event: Event) => {
      if (this.dropdown && !this.dropdown.nativeElement.contains(event.target)) {
        this.visibilityOptionsOpen = false;
        this.removeClickListener();
      }
    });
  }

  private removeClickListener() {
    if (this.clickListener) {
      this.clickListener();
      this.clickListener = null;
    }
  }

  ngOnDestroy() {
    this.removeClickListener();
  }

  changeVisibility(option: string) {
    // Handle visibility change logic here
    console.log(`Changed visibility to: ${option}`);
    this.visibilityOptionsOpen = false;
    this.removeClickListener();
  }

  async showComments() {
    this.router.navigate(['/tabs/channels/post/' + this.post.id], {
      queryParams: {
        channel: JSON.stringify(this.channel.toObject())
      }
    });
  }
  

  showUserProfile(id: string) {
    if (!this.post.anonyme && this.user.id !== id) {
      this.router.navigate(['/tabs/profile/display/' + id]);
    }
  }

  async presentPopover(ev: any) {
    const popoverItems = this.post.user.id === this.user.id
      ? [{ text: 'Delete', icon: 'fas fa-trash-alt', event: 'delete' }]
      : [{ text: 'Report', icon: 'fas fa-exclamation-triangle', event: 'report' }];

    const popover = await this.popoverController.create({
      component: DropDownComponent,
      event: ev,
      cssClass: 'dropdown-popover',
      showBackdrop: false,
      componentProps: { items: popoverItems }
    });
    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (data && data.event) {
      if (data.event === 'delete') {
        this.deletePostConf();
      } else if (data.event === 'report') {
        this.reportPost();
      }
    }
  }

  async deletePostConf() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Post',
      message: 'Do you really want to delete this post?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Yes', handler: () => this.deletePost(), cssClass: "text-danger" }
      ]
    });
    await alert.present();
  }

  deletePost() {
    this.channelService.deletePost(this.post.id).then(
      (resp: any) => {
        this.removePost.emit();
        this.toastService.presentStdToastr(resp.message);
      },
      err => {
        this.toastService.presentStdToastr(err);
      }
    );
  }

  async reportPost() {
    const alert = await this.alertCtrl.create({
      header: 'Report Post',
      inputs: [{ type: 'text', name: 'message', placeholder: 'Message' }],
      buttons: [
        { text: 'CANCEL', role: 'cancel' },
        {
          text: 'SEND',
          cssClass: 'text-danger',
          handler: (val) => {
            this.channelService.reportPost(this.post.id, val.message).then(
              (resp: any) => {
                this.toastService.presentStdToastr(resp.message);
              },
              err => {
                this.toastService.presentStdToastr(err);
              }
            );
          }
        }
      ]
    });
    await alert.present();
  }
}
