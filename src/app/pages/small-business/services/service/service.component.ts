import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { AlertController, PopoverController, Platform } from '@ionic/angular';
import { ToastService } from './../../../../services/toast.service';
import { ServiceService } from './../../../../services/service.service';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from './../../../../models/User';
import constants from 'src/app/helpers/constants';
import { Service } from './../../../../models/Service';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CallNumber } from '@ionic-native/call-number/ngx';
import { DropDownComponent } from 'src/app/pages/drop-down/drop-down.component';
import { OneSignalService } from 'src/app/services/one-signal.service';


@Component({
  selector: 'app-service',
  templateUrl: './service.component.html',
  styleUrls: ['./service.component.scss'],
})
export class ServiceComponent implements OnInit {

  pageLoading = false;
  service: Service;
  serviceId: string;
  domain = constants.DOMAIN_URL;
  page: number = 1;
  user: User;

  constructor(private serviceService: ServiceService, private route: ActivatedRoute, private popoverController: PopoverController,
              private toastService: ToastService, private alertCtrl: AlertController,
              private router: Router, private nativeStorage: NativeStorage, private callNumber: CallNumber,
              private platform: Platform, private changeDetectorRef: ChangeDetectorRef, private oneSignalService: OneSignalService) { }

  ngOnInit() {
    this.getUserData();
  }

  ionViewWillEnter(){
    this.getServiceId();
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
     // this.oneSignalService.open(this.user._id);
      this.changeDetectorRef.detectChanges();
      console.log('User initialized successfully:', this.user);
    } else {
      console.error('Invalid user data:', user);
    }
  }

  
  getServiceId(){
    this.route.paramMap
    .subscribe(
      params => {
        this.serviceId = params.get('id');
        this.getService();
      }
    )
  }

  getService(){
    this.pageLoading = true;
    this.serviceService.get(this.serviceId)
    .then(
      (resp: any) => {
        this.pageLoading = false;
        this.service = new Service(resp.data);
        console.log("this.service this.service",this.service); // Check the format of the createdAt field

        this.page++;
        console.log(this.service);
      },
      err => {
        this.pageLoading = false;
        console.log(err);
        this.toastService.presentStdToastr(err);
      }
    )
  }

  removeService(){
    this.serviceService.remove(this.service.id)
    .then(
      (resp: any) => {
        console.log(resp);
        this.toastService.presentStdToastr(resp.message);
        this.router.navigateByUrl('/tabs/small-business/services/list/posted')
      },
      err => {
        console.log(err);
        this.toastService.presentStdToastr(err);
      }
    )
  }

  async removeConfirmation(){
    const alert = await this.alertCtrl.create({
      message: 'Do you really want to delete this service ?',
      header: 'Delete Service',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes',
          cssClass: 'text-danger',
          handler: () => {
            this.removeService();
          }
        }
      ]
    });

    await alert.present();
  }

  call(){
    this.callNumber.callNumber(this.service.phone, true)
      .then(res => console.log('Launched dialer!', res))
      .catch(err => this.toastService.presentStdToastr('Cannot make this call'));
  }

  async presentPopover(ev: any) {
    const popoverItems = [
      {
        text: 'Report',
        icon: 'fas fa-exclamation-triangle',
        event: 'report'
      }
    ]
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
    if(data && data.event){
      if(data.event == 'report') this.reportService();
    }
  }

  async reportService(){
    const alert = await this.alertCtrl.create({
      header: 'Report Service',
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
            this.serviceService.report(this.service.id, message)
            .then(
              (resp: any) => {
                this.toastService.presentStdToastr(resp.message);
              },
              err => {
                this.toastService.presentStdToastr(err);
              }
            )
          }
        }
      ]
    });
    await alert.present();
  }

}
