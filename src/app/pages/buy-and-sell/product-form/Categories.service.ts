import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor() {}

  // Predefined categories with associated icons for buying and selling
  getCategories(): Observable<{ name: string, icon: string }[]> {
    const categories = [
      { name: 'Electronics', icon: 'tv-outline' },
      { name: 'Jewelry', icon: 'diamond-outline' },
      { name: 'Men\'s Clothing', icon: 'shirt-outline' },
      { name: 'Women\'s Clothing', icon: 'woman-outline' },
      { name: 'Home Appliances', icon: 'home-outline' },
      { name: 'Books', icon: 'book-outline' },
      { name: 'Beauty Products', icon: 'brush-outline' },
      { name: 'Toys & Games', icon: 'game-controller-outline' },
      { name: 'Sports Gear', icon: 'football-outline' },
      { name: 'Automotive', icon: 'car-outline' },
      { name: 'Furniture', icon: 'bed-outline' },
      { name: 'Health Care', icon: 'heart-outline' },
      { name: 'Garden & Outdoor', icon: 'leaf-outline' },
      { name: 'Pet Supplies', icon: 'paw-outline' },
      { name: 'Office Supplies', icon: 'document-outline' },
      { name: 'Groceries', icon: 'cart-outline' },
      { name: 'Musical Instruments', icon: 'musical-notes-outline' },
      { name: 'Baby Products', icon: 'heart-outline' },
      { name: 'Tools & Improvement', icon: 'hammer-outline' },
      { name: 'Smartphones & Accessories', icon: 'phone-portrait-outline' },
      { name: 'Computers & Accessories', icon: 'desktop-outline' },
      { name: 'Video Games', icon: 'game-controller-outline' },
      { name: 'Cameras & Photography', icon: 'camera-outline' },
      { name: 'Wearable Tech', icon: 'watch-outline' },
      { name: 'Luggage & Travel Gear', icon: 'briefcase-outline' },
      { name: 'Watches', icon: 'time-outline' },
      { name: 'Handbags & Wallets', icon: 'bag-outline' },
      { name: 'Footwear', icon: 'footsteps-outline' },
      { name: 'Arts & Crafts', icon: 'color-palette-outline' },
      { name: 'Kitchen & Dining', icon: 'restaurant-outline' },
      { name: 'Lighting', icon: 'bulb-outline' },
      { name: 'Home Décor', icon: 'flower-outline' },
      { name: 'Bath & Bedding', icon: 'bed-outline' },
      { name: 'Heating & Air Quality', icon: 'thermometer-outline' },
      { name: 'Cleaning Supplies', icon: 'trash-outline' },
      { name: 'Storage & Organization', icon: 'folder-outline' },
      { name: 'Movies & TV', icon: 'film-outline' },
      { name: 'Music', icon: 'musical-notes-outline' },
      { name: 'Office Electronics', icon: 'print-outline' },
      { name: 'Outdoor Gear', icon: 'bicycle-outline' },
      { name: 'Cycling', icon: 'bicycle-outline' },
      { name: 'Hunting & Fishing', icon: 'fish-outline' },
      { name: 'Camping & Hiking', icon: 'bonfire-outline' },
      { name: 'Skateboards & Scooters', icon: 'bicycle-outline' },
      { name: 'Luxury Goods', icon: 'diamond-outline' },
      { name: 'Vintage & Collectibles', icon: 'pricetag-outline' },
      { name: 'Party Supplies', icon: 'gift-outline' },
      { name: 'Costumes & Accessories', icon: 'accessibility-outline' },
      { name: 'Board Games & Puzzles', icon: 'dice-outline' },
      { name: 'Educational Supplies', icon: 'school-outline' },
      { name: 'Scientific Gear', icon: 'beaker-outline' },
      { name: 'Survival Gear', icon: 'medkit-outline' },
      { name: 'Gourmet Food & Drink', icon: 'restaurant-outline' },
      { name: 'Gift Cards & Vouchers', icon: 'card-outline' },
      { name: 'Religious Items', icon: 'book-outline' },
      { name: 'Ethnic Clothing', icon: 'shirt-outline' },
      { name: 'Wedding Supplies', icon: 'heart-outline' },
      { name: 'Eco-Friendly Products', icon: 'leaf-outline' },
      { name: 'DIY Kits', icon: 'construct-outline' },
      { name: 'Photography Equipment', icon: 'camera-outline' },
      { name: 'Fitness Equipment', icon: 'barbell-outline' }
    ];
  
    return of(categories);
  }
}
