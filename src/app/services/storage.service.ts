import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { MockNativeStorage } from './mock-native-storage.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private isCordovaAvailable: boolean;
  private storage: NativeStorage | MockNativeStorage;

  constructor(private platform: Platform, nativeStorage: NativeStorage, mockNativeStorage: MockNativeStorage) {
    this.isCordovaAvailable = this.platform.is('cordova');
    this.storage = this.isCordovaAvailable ? nativeStorage : mockNativeStorage;
  }

  setItem(key: string, value: any): Promise<any> {
    return this.storage.setItem(key, value);
  }

  getItem(key: string): Promise<any> {
    return this.storage.getItem(key);
  }

  removeItem(key: string): Promise<any> {
    return this.storage.remove(key);
  }
}
