import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MockNativeStorage {
  private storage = new Map<string, any>();

  getItem(key: string): Promise<any> {
    return Promise.resolve(this.storage.get(key));
  }

  setItem(key: string, value: any): Promise<any> {
    this.storage.set(key, value);
    return Promise.resolve(value);
  }

  remove(key: string): Promise<any> {
    this.storage.delete(key);
    return Promise.resolve();
  }
}
