import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { HTTP } from '@ionic-native/http/ngx';import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { HttpClient } from '@angular/common/http';
import { DataService } from './data.service';
import { Platform } from '@ionic/angular';
import { GooglePlus } from '@ionic-native/google-plus/ngx';

declare const gapi: any; // Declare gapi for TypeScript

@Injectable({
  providedIn: 'root'
})
export class AuthService extends DataService {

  constructor(
    nativeStorage: NativeStorage, 
    http: HTTP, 
    httpClient: HttpClient, 
    router: Router, 
    platform: Platform,  
    private googlePlus: GooglePlus,
    private ngZone: NgZone // Added NgZone
  ) {
    super('auth/', nativeStorage, http, httpClient, router, platform);
  //  this.loadGoogleAuthLibrary(); // Load Google Auth Library
  }

  private loadGoogleAuthLibrary() {
    return new Promise<void>((resolve, reject) => {
      gapi.load('auth2', () => {
        gapi.auth2.init({
          client_id: '785598983692-igiasirmagu9p3du2a04j67nfvkp81p7.apps.googleusercontent.com'
        }).then(() => {
          resolve();
        }).catch((error: any) => {
          reject(error);
        });
      });
    });
  }

  getCurrentUserId() {
    return localStorage.getItem('userId'); // Example: Adjust based on authentication method
  }
  
  verifyEmail(email: string) {
    return this.sendRequest({
      method: 'post',
      url: 'checkEmail',
      data: { email }
    });
  }

  signup(data: any) {
    return this.sendRequest({
      method: 'post',
      url: 'signup',
      data
    });
  }

  googleSignIn() {
    if (this.platform.is('cordova')) {
      return this.googlePlus.login({
        'webClientId': '785598983692-igiasirmagu9p3du2a04j67nfvkp81p7.apps.googleusercontent.com',
        'offline': true
      }).then(response => {
        console.log('Google login response:', response);
        // Send the token to your backend for verification and user creation
        return this.sendRequest({
          method: 'post',
          url: 'google-signin',
          data: { token: response.idToken }
        });
      }).catch(error => {
        console.error('Google login error:', error);
        throw error;
      });
    } else {
      // Fallback for web browser
      return new Promise((resolve, reject) => {
        this.loadGoogleAuthLibrary().then(() => {
          const auth2 = gapi.auth2.getAuthInstance();
          auth2.signIn().then((googleUser: any) => {
            const idToken = googleUser.getAuthResponse().id_token;
            console.log('Google login response:', googleUser);
            // Send the token to your backend for verification and user creation
            this.sendRequest({
              method: 'post',
              url: 'google-signin',
              data: { token: idToken }
            }).then(resolve).catch(reject);
          }).catch((error: any) => {
            console.error('Google login error:', error);
            reject(error);
          });
        }).catch((error: any) => {
          console.error('Google Auth Library load error:', error);
          reject(error);
        });
      });
    }
  }

  googleSignUp() {
    if (this.platform.is('cordova')) {
      return this.googlePlus.login({
        'webClientId': '785598983692-igiasirmagu9p3du2a04j67nfvkp81p7.apps.googleusercontent.com',
        'offline': true
      }).then(response => {
        console.log('Google login response:', response);
        // Send the token to your backend for verification and user creation
        return this.sendRequest({
          method: 'post',
          url: 'google-signup',
          data: { token: response.idToken }
        });
      }).catch(error => {
        console.error('Google signup error:', error);
        throw error;
      });
    } else {
      // Fallback for web browser
      return new Promise((resolve, reject) => {
        this.loadGoogleAuthLibrary().then(() => {
          const auth2 = gapi.auth2.getAuthInstance();
          auth2.signIn().then((googleUser: any) => {
            const idToken = googleUser.getAuthResponse().id_token;
            console.log('Google login response:', googleUser);
            // Send the token to your backend for verification and user creation
            this.sendRequest({
              method: 'post',
              url: 'google-signup',
              data: { token: idToken }
            }).then(resolve).catch(reject);
          }).catch((error: any) => {
            console.error('Google signup error:', error);
            reject(error);
          });
        }).catch((error: any) => {
          console.error('Google Auth Library load error:', error);
          reject(error);
        });
      });
    }
  }

  signin(data: any) {
    return this.sendRequest({
      method: 'post',
      url: 'signin',
      data
    });
  }

  signout() {
    console.log('Sending signout request to server'); // Log to verify request initiation
    return this.sendRequest({
      method: 'post',
      url: 'signout'
    }).then(response => {
      console.log('Signout response:', response); // Log to verify response
      return response;
    }).catch(error => {
      console.error('Signout error:', error); // Log to capture error
      throw error;
    });
  }

  getAuthUser() {
    return this.sendRequest({
      method: 'get',
      url: 'user'
    });
  }

  getUserId(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user ? user._id : null;
    } catch (error) {
      console.error('Error retrieving user ID', error);
      return null;
    }
  }
}
