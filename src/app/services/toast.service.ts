import { Injectable } from '@angular/core';
import { ToastController, Platform } from '@ionic/angular';
import { Toast } from '@ionic-native/toast/ngx';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  constructor(private toastCtrl: ToastController, private toast: Toast, private platform: Platform) { }

  async presentErrorToastr(err: string, position: any = 'bottom') {
    if (this.platform.is('cordova')) {
      this.toast.show(err, '2000', position).subscribe(
        toast => {
          console.log(toast);
        },
        error => {
          console.error('Error showing native toast', error);
        }
      );
    } else {
      const toastr = await this.toastCtrl.create({
        message: err,
        position,
        color: 'danger',
        duration: 2000,
      });

      toastr.present();
    }
  }

  async presentStdToastr(msg: string) {
    if (this.platform.is('cordova')) {
      this.toast.show(msg, '1500', 'bottom').subscribe(
        toast => {
          console.log(toast);
        },
        error => {
          console.error('Error showing native toast', error);
        }
      );
    } else {
      const toastr = await this.toastCtrl.create({
        message: msg,
        position: 'bottom',
        duration: 1500,
      });

      toastr.present();
    }
  }

  async presentSuccessToastr(success: string) {
    if (this.platform.is('cordova')) {
      this.toast.show(success, '2000', 'bottom').subscribe(
        toast => {
          console.log(toast);
        },
        error => {
          console.error('Error showing native toast', error);
        }
      );
    } else {
      const toastr = await this.toastCtrl.create({
        message: success,
        position: 'bottom',
        color: 'success',
        duration: 2000,
      });

      toastr.present();
    }
  }
}
