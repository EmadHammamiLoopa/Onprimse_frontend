import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MockAdMobFree {
  interstitial = {
    config: (config: any) => console.log('MockAdMobFree: Interstitial config', config),
    prepare: () => Promise.resolve(),
    show: () => Promise.resolve()
  };
  banner = {
    config: (config: any) => console.log('MockAdMobFree: Banner config', config),
    prepare: () => Promise.resolve(),
    show: () => Promise.resolve()
  };
  events = {
    INTERSTITIAL_LOAD: 'admob.interstitial.load',
    BANNER_LOAD: 'admob.banner.load'
  };
  on(event: string) {
    return {
      subscribe: (callback: () => void) => console.log(`MockAdMobFree: Subscribed to ${event}`)
    };
  }
}
