import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MockStatusBar {
  styleLightContent() {
    console.log('MockStatusBar: styleLightContent called');
  }
}
