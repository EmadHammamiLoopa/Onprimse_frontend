import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

type TabKey =
  | 'profile'
  | 'friends'
  | 'messages'
  | 'new-friends'
  | 'channels'
  | 'buy-and-sell'
  | 'small-business';

@Injectable({ providedIn: 'root' })
export class AppEventsService {
  private subjects = new Map<TabKey, BehaviorSubject<number>>();
  private debug = true; // Set to false in production

  constructor(private zone: NgZone) {
    // seed all known tabs with 0
    ['profile','friends','messages','new-friends','channels','buy-and-sell','small-business']
      .forEach(k => this.subjects.set(k as TabKey, new BehaviorSubject<number>(0)));
  }

  /** Observable stream for a tab's badge count */
  badge$(tab: TabKey): Observable<number> {
    return (this.subjects.get(tab) ?? this.ensure(tab)).asObservable();
  }

  /** Current numeric value (for logic) */
  get(tab: TabKey): number {
    return (this.subjects.get(tab) ?? this.ensure(tab)).value;
  }

  /** Set absolute value */
  set(tab: TabKey, count: number): void {
    if (this.debug) console.log(`Setting ${tab} badge to ${count}`);
    this.zone.run(() => (this.subjects.get(tab) ?? this.ensure(tab)).next(Math.max(0, count || 0)));
  }

  /** Increment/decrement by delta (can be negative) */
  inc(tab: TabKey, delta = 1): void {
    if (this.debug) console.log(`Incrementing ${tab} badge by ${delta}`);
    const s = this.subjects.get(tab) ?? this.ensure(tab);
    this.zone.run(() => s.next(Math.max(0, (s.value || 0) + (delta || 0))));
  }

  /** Reset to zero */
  reset(tab: TabKey): void {
    if (this.debug) console.log(`Resetting ${tab} badge to 0`);
    this.set(tab, 0);
  }

  private ensure(tab: TabKey): BehaviorSubject<number> {
    const s = new BehaviorSubject<number>(0);
    this.subjects.set(tab, s);
    return s;
  }
}