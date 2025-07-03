import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-channel-popover',
  template: `
    <ion-content class="ion-padding">
      <h2>{{ channel.name }}</h2>
      <p>{{ getEnhancedDescription(channel.name) }}</p>
      <ion-item-divider></ion-item-divider>
      <p class="text-muted">
        Disclaimer: This channel is a community-driven space. Please note that opinions expressed here are those of the individuals and not of the platform. Stay mindful and respectful when engaging.
      </p>
    </ion-content>
  `,
  styles: [`
    ion-content {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      color: #333;
      box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
    }

    h2 {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;  /* Improved contrast for better readability */
      text-align: center;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    }

    p {
      font-size: 1rem;
      line-height: 1.6;
      color: #555;  /* Improved contrast for better readability */
      margin-bottom: 10px;
      text-align: center;
    }

    ion-item-divider {
      background: rgba(0, 0, 0, 0.05);
      margin: 20px 0;
      height: 1px;
      border-radius: 5px;
    }

    .text-muted {
      color: #777;  /* Lighter grey for the disclaimer */
      font-size: 0.85rem;
      line-height: 1.4;
      text-align: center;
      margin-top: 15px;
    }

    ion-content::part(scroll) {
      padding: 20px;
    }
  `]
})
export class ChannelPopoverComponent {
  @Input() channel: any;

  getEnhancedDescription(name: string): string {
    switch (name) {
      case `${this.channel.city} Local News`:
        return `Get the latest updates and breaking news in ${this.channel.city}. Stay connected to everything happening around you.`;
      case `${this.channel.city} Arts and Culture`:
        return `Immerse yourself in the rich arts and culture scene of ${this.channel.city}. From live performances to art galleries, there's always something inspiring.`;
      case `${this.channel.city} Lost & Found`:
        return `Lost something important? Found something valuable? This is your go-to spot for reconnecting lost items with their owners in ${this.channel.city}.`;
      case `${this.channel.city} Neighborhood Watch`:
        return `Keep ${this.channel.city} safe by staying informed. Share safety tips and neighborhood alerts to ensure a secure environment for everyone.`;
      default:
        return this.channel.description;
    }
  }
}
