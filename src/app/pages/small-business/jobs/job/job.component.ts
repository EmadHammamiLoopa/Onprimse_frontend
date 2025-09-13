import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { ToastService } from './../../../../services/toast.service';
import { AlertController, Platform, PopoverController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { JobService } from './../../../../services/job.service';
import { User } from './../../../../models/User';
import { Job } from './../../../../models/Job';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import constants from 'src/app/helpers/constants';
import { DropDownComponent } from 'src/app/pages/drop-down/drop-down.component';
import { OneSignalService } from 'src/app/services/one-signal.service';

@Component({
  selector: 'app-job',
  templateUrl: './job.component.html',
  styleUrls: ['./job.component.scss'],
})
export class JobComponent implements OnInit {

  pageLoading = false;
  job: Job;
  jobId: string;
  domain = constants.DOMAIN_URL;
  page: number = 1;
  user: User;

  constructor(
    private jobService: JobService, private route: ActivatedRoute, private popoverController: PopoverController,
    private toastService: ToastService, private alertCtrl: AlertController,
    private router: Router, private nativeStorage: NativeStorage, private changeDetectorRef: ChangeDetectorRef,
    private platform: Platform, private oneSignalService: OneSignalService
  ) { }

  ngOnInit() {
    this.getUserData();
  }

  ionViewWillEnter() {
    this.getJobId();
  }

  private getUserData() {
    if (this.platform.is('cordova')) {
      this.nativeStorage.getItem('user')
        .then(user => {
          console.log('Fetched user data from NativeStorage:', user);
          this.initializeUser(user);
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
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      console.log('Fetched user data from localStorage:', user);
      this.initializeUser(user);
    } else {
      console.log('User data not found in localStorage');
      this.toastService.presentStdToastr('User data not found. Please log in again.');
      this.router.navigateByUrl('/auth/signin');
    }
  }

  private initializeUser(user: any) {
    if (user) {
      this.user = new User().initialize(user);
   //   this.oneSignalService.open(this.user._id);
      this.changeDetectorRef.detectChanges();
      console.log('User initialized successfully:', this.user);
    } else {
      console.error('Invalid user data:', user);
    }
  }

  
  getJobId() {
    this.route.paramMap.subscribe(params => {
      this.jobId = params.get('id');
      this.getJob();
    });
  }

  getJob() {
    this.pageLoading = true;
    this.jobService.get(this.jobId).then((resp: any) => {
      this.pageLoading = false;
      this.job = new Job(resp.data);
      this.page++;
      console.log(this.job);
    }).catch(err => {
      this.pageLoading = false;
      console.log(err);
      this.toastService.presentStdToastr(err);
    });
  }

  removeJob() {
    this.jobService.remove(this.job.id).then((resp: any) => {
      console.log(resp);
      this.toastService.presentStdToastr(resp.message);
      this.router.navigateByUrl('/tabs/small-business/jobs/list/posted');
    }).catch(err => {
      console.log(err);
      this.toastService.presentStdToastr(err);
    });
  }

  sendEmail() {
    const subject = encodeURIComponent('Job Inquiry: ' + this.job.title);
    const body = encodeURIComponent('Dear ' + this.job.company + ',\n\nI am interested in the job position titled "' + this.job.title + '".\n\nRegards,\n');
    window.open(`mailto:${this.job.email}?subject=${subject}&body=${body}`);
  }

  async removeConfirmation() {
    const alert = await this.alertCtrl.create({
      message: 'Do you really want to delete this job?',
      header: 'Delete Job',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes',
          cssClass: 'text-danger',
          handler: () => {
            this.removeJob();
          }
        }
      ]
    });

    await alert.present();
  }

  openMail() {
    window.open('mailto:' + this.job.email);
  }

  async presentPopover(ev: any) {
    const popoverItems = [
      {
        text: 'Report',
        icon: 'fas fa-exclamation-triangle',
        event: 'report'
      }
    ];
    const popover = await this.popoverController.create({
      component: DropDownComponent,
      event: ev,
      cssClass: 'dropdown-popover',
      showBackdrop: false,
      componentProps: {
        items: popoverItems
      }
    });
    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (data && data.event) {
      if (data.event === 'report') this.reportJob();
    }
  }

  async reportJob() {
    const alert = await this.alertCtrl.create({
      header: 'Report Job',
      inputs: [
        {
          type: 'text',
          name: 'message',
          placeholder: 'Message'
        }
      ],
      buttons: [
        {
          text: 'CANCEL',
          role: 'cancel'
        },
        {
          text: 'SEND',
          cssClass: 'text-danger',
          handler: (val) => {
            const message = val.message;
            this.jobService.report(this.job.id, message).then((resp: any) => {
              this.toastService.presentStdToastr(resp.message);
            }).catch(err => {
              this.toastService.presentStdToastr(err);
            });
          }
        }
      ]
    });
    await alert.present();
  }
}
