import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { catchError, map } from 'rxjs/operators';
import { User } from '../models/User';
import constants from '../helpers/constants';
import { StorageService } from './storage.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = `${environment.apiUrl}/user`;
  private currentUserSubject: BehaviorSubject<User>;
  public currentUser: Observable<User>;
  private viewedUserSubject: BehaviorSubject<User>;
  public viewedUser: Observable<User>;

  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private nativeStorage: NativeStorage // ✅ Add clearly
  ) {
    this.currentUserSubject = new BehaviorSubject<User>(null);
    this.currentUser = this.currentUserSubject.asObservable();
  
    this.viewedUserSubject = new BehaviorSubject<User>(null);
    this.viewedUser = this.viewedUserSubject.asObservable();
  
    this.initCurrentUser(); // ✅ initialize clearly
  }
  

  private async initCurrentUser() {
    try {
      let user: User = await this.nativeStorage.getItem('user');
  
      if (!user) {
        const localStorageUser = localStorage.getItem('user');
        user = localStorageUser ? JSON.parse(localStorageUser) : null;
      }
  
      if (user) {
        this.currentUserSubject.next(new User().initialize(user));
        console.log('✅ Current user initialized:', user);
      } else {
        console.warn('⚠️ No user found in any storage');
      }
  
    } catch (error) {
      console.error('❌ Initialization error:', error);
    }
  }
  public get currentUserValue(): User {
    return this.currentUserSubject.value;
  }

  public get viewedUserValue(): User {
    return this.viewedUserSubject.value;
  }

  setCurrentUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  setViewedUser(user: User) {
    this.viewedUserSubject.next(user);
  }

  clearViewedUser() {
    this.viewedUserSubject.next(null);
  }

  updateUser(id: string, data: any): Observable<any> {
    console.log('Updating user with ID: ', id);
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  removeAvatar(userId: string, avatarUrl: string): Observable<any> {
    const encodedAvatarUrl = encodeURIComponent(avatarUrl);
    return this.http.delete(`${constants.DOMAIN_URL}${constants.API_V1}user/remove-avatar/${userId}/${encodedAvatarUrl}`);
  }

  updateAvatar(userId: string, formData: FormData): Observable<any> {
    const url = `${this.apiUrl}/${userId}/avatar`;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.put(url, formData, { headers }).pipe(
      map((response: any) => {
        if (response && response.user) {
          return response.user;
        } else {
          throw new Error('Invalid response structure');
        }
      })
    );
  }

  // user.service.ts
getCurrentUserId(): string | null {
  const user = JSON.parse(localStorage.getItem('user')); // Or use sessionStorage if needed
  return user ? user._id : null;
}


  getUserProfile(userId: string): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/profile/${userId}`).pipe(
      map((response: any) => {
        if (response && response.data) {
          const userData = response.data;
          console.log("userData:", userData);
          console.log("response userData:", response);
          console.log("response.data userData:", response.data);

          userData.avatar = Array.isArray(userData.avatar) ? userData.avatar : [];
          userData.birthDate = userData.birthDate ? new Date(userData.birthDate) : null;
          userData.gender = userData.gender || 'Not specified';
          const user = new User().initialize(userData);
          this.storageService.setItem(`user-profile-${userId}`, userData);
          console.log('User data fetched and stored:', userData);
          return user;
        } else {
          throw new Error('Invalid response data');
        }
      }),
      catchError((error) => {
        console.error('Error fetching user profile:', error);
        return throwError('Error fetching user profile');
      })
    );
  }

  uploadAvatar(userId: string, formData: FormData): Observable<any> {
    return this.http.put(`${constants.DOMAIN_URL}${constants.API_V1}user/${userId}/avatar`, formData);
  }

  updateMainAvatar(userId: string, avatarUrl: string): Observable<any> {
    return this.http.put(`${constants.DOMAIN_URL}${constants.API_V1}user/update-main-avatar/${userId}`, { avatarUrl });
  }

  getUsers(page: number, options: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`, { params: { page: page.toString(), ...options } });
  }

  refreshFriendsList(): Promise<any> { // Add this method to refresh friends list
    return this.http.get(`${this.apiUrl}/user/friends`).toPromise();
  }

  getPartnerPeerId(userId: string): Observable<string | null> {
    return this.http.get<{ success: boolean; peerId?: string; message: string }>(
      `${this.apiUrl}/${userId}/peer`
    ).pipe(
      map(response => {
        return response.success && response.peerId ? response.peerId : null;
      }),
      catchError(error => {
        console.error('❌ Peer lookup error:', error);
        return throwError(() => new Error('Error fetching partner peer ID'));
      })
    );
  }
  
  heartbeatPeer(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.patch(`${this.apiUrl}/${userId}/peer/heartbeat`, {}, {
        headers: { 'Content-Type': 'application/json' }
      }).subscribe(
        ()  => resolve(),
        err => reject(err)
      );
    });
  }
  
  sendPeerIdToBackend(userId: string, peerId: string): Promise<void> {
    console.log("peerIdpeerIdpeerIdpeerId to backend:", peerId);

    return new Promise((resolve, reject) => {
        this.http.post(`${this.apiUrl}/${userId}/peer`, { peerId }, {
            headers: { 'Content-Type': 'application/json' }
        }).subscribe(
            response => {
                console.log("✅ Peer ID successfully sent to backend:", response);
                resolve();
            },
            error => {
                console.error("❌ Error sending Peer ID to backend:", error);
                reject(error);
            }
        );
    });
}


  follow(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/follow/${id}`, {});
  }

  getFriends(page: number): Observable<any> {
    const token = localStorage.getItem('token'); // or wherever you store your token
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    console.log(`Fetching friends for page: ${page}`);
    return this.http.get(`${this.apiUrl}/friends`, { // ✅ Ensure the correct URL
      headers: headers,
      params: { page: page.toString() } 
    });
  }


  removeFriendship(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/friends/remove/${id}`, {});
  }

  block(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/block`, {});
  }

  report(id: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/report`, { message });
  }

  updateEmail(id: string, email: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/email`, { email });
  }

  updatePassword(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/password`, data);
  }


  updateRandomVisibility(userId: string, visible: boolean): Observable<any> {
    console.log('Updating visibility to:', visible);
    return this.http.put(`${this.apiUrl}/randomVisibility`, { userId, visible });
}




  updateAgeVisibility(visible: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/ageVisibility`, { visible });
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(this.apiUrl);
  }

  profileVisited(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile-visited`, { headers: { 'Cache-Control': 'no-cache' } });
  }


  getAuthUser(): Promise<User> {
    return new Promise((resolve, reject) => {
      this.nativeStorage.getItem('user').then(
        user => {
          resolve(new User().initialize(user));
        },
        err => {
          reject(err);
        }
      );
    });
  }

}
