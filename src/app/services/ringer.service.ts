// ringer.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RingerService {
  private player: HTMLAudioElement | null = null;

  /** Start playing a looping ringtone */
  start(file: string) {
    this.stop(); // Stop previous sound if any
    const audio = new Audio(`assets/audio/${file}`);
    audio.loop = true;
    audio.preload = 'auto';
    this.player = audio;

    const tryPlay = () => {
      if (!this.player) return;
      this.player.play().catch(() => {
        const resume = () => {
          if (!this.player) return;
          this.player.play().catch(() => {});
          document.removeEventListener('click', resume);
        };
        document.addEventListener('click', resume, { once: true });
      });
    };

    if (audio.readyState >= 3) {
      tryPlay();
    } else {
      audio.oncanplay = tryPlay;
    }
  }

  /** Play a short one-time sound effect */
  playOnce(file: string) {
    const audio = new Audio(`assets/audio/${file}`);
    audio.preload = 'auto';
    audio.play().catch(() => {});
  }

  /** Stop the current ringtone */
  stop() {
    if (this.player) {
      this.player.pause();
      this.player.src = '';
      this.player.load(); // free up memory
      this.player = null;
    }
  }
}
