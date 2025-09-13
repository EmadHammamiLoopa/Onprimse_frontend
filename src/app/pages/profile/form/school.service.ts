import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

interface University {
  name: string;
  country: string;
  alpha_two_code: string; // e.g., "NO", "US"
}

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private readonly dataUrl =
    'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json';

  // Cache the full list (one network call)
  private readonly universities$: Observable<University[]>;

  constructor(private http: HttpClient) {
    this.universities$ = this.http.get<University[]>(this.dataUrl).pipe(
      shareReplay(1)
    );
  }

  /**
   * Get university names for a given country.
   * Accepts full country name ("Norway") or ISO alpha-2 code ("NO").
   */
  getUniversityNames(country: string): Observable<string[]> {
    const norm = (country || '').trim().toLowerCase();

    return this.universities$.pipe(
      map(list =>
        list.filter(u =>
          u.country.toLowerCase() === norm ||
          u.alpha_two_code.toLowerCase() === norm
        )
      ),
      map(list => Array.from(new Set(list.map(u => u.name)))
        .sort((a, b) => a.localeCompare(b))
      )
    );
  }
}
