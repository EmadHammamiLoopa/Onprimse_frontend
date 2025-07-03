import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  // Update the URL to use HTTPS
  private universitiesApiUrl = 'http://universities.hipolabs.com/search'; // Changed to HTTPS

  constructor(private https: HttpClient) {}

  getUniversities(): Observable<any> {
    return this.https.get(this.universitiesApiUrl);
  }
}
