import { Router } from '@angular/router';
import { HTTP } from '@ionic-native/http/ngx';import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { DataService } from './data.service';
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class RequestService extends DataService {

  constructor(nativeStorage: NativeStorage, http: HTTP, httpClient: HttpClient, router: Router, platform: Platform) {
    super('request', nativeStorage, http, httpClient, router, platform);
  }

  request(id: string){
    return this.sendRequest({
      method: 'post',
      url: '/' + id
    })
  }

  async requests(page: number) {
    const token = await this.getToken();
    if (!token) {
      console.warn("No token found, skipping request."); // ✅ Prevents request if user isn't logged in
      return Promise.resolve(null);
    }
  
    return this.sendRequest({
      method: 'get',
      url: '/requests',
      params: { page: page.toString() },
    });
  }

  acceptRequest(id: string) {
    if (!id) {
      return Promise.reject('Invalid request ID');
    }
    return this.sendRequest({
      method: 'post',
      url: '/accept/' + id
    });
  }
  
  cancelRequest(id: string) {
    if (!id) {
      return Promise.reject('Invalid request ID');
    }
    return this.sendRequest({
      method: 'post',
      url: '/cancel/' + id
    });
  }


  rejectRequest(id: string){
    return this.sendRequest({
      method: 'post',
      url: '/reject/' + id
    })
  }
}
