import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MockSplashScreen {
  hide() {
    console.log('MockSplashScreen: hide called');
  }
}
