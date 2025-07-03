import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { Platform } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private nativeStorage: NativeStorage, private platform: Platform) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return from(this.platform.ready()).pipe(
      switchMap(() => {
        if (this.platform.is('cordova')) {
          return from(this.nativeStorage.getItem('token').catch(err => {
            console.log('Auth token not found in NativeStorage', err);
            return null;
          }));
        } else {
          return from(Promise.resolve(localStorage.getItem('token')));
        }
      }),
      switchMap(token => {
        if (token) {
      //    console.log('Token:', token); // Log the token
          const cloned = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
          });
          return next.handle(cloned);
        } else {
          return next.handle(req);
        }
      })
    );
  }
}
