import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private apiUrl = 'http://jobs.github.com/positions.json';

  constructor(private https: HttpClient) {}

  getJobsByCity(city: string): Observable<any> {
    const url = `${this.apiUrl}?location=${city}`;
    return this.https.get(url);
  }
}
