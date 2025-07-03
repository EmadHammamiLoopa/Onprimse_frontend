import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MockNetwork {
  onDisconnect(): Observable<any> {
    console.log('MockNetwork: onDisconnect called');
    return of();
  }

  onConnect(): Observable<any> {
    console.log('MockNetwork: onConnect called');
    return of();
  }

  type: string = 'wifi';
}
