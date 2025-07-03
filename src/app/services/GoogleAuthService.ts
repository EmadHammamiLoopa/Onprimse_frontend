import { Injectable, NgZone } from '@angular/core';

declare const gapi: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  constructor(private ngZone: NgZone) {
    gapi.load('auth2', () => {
      gapi.auth2.init({
        client_id: '785598983692-igiasirmagu9p3du2a04j67nfvkp81p7.apps.googleusercontent.com',
        cookiepolicy: 'single_host_origin',
      }).then(() => {
        console.log('Google Auth initialized');
      });
    });
  }
}
