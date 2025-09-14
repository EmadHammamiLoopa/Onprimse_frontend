import { SafeUrl } from '@angular/platform-browser';
import constants from '../helpers/constants';
import { Product } from './Product';

export class Message {
  public _id: string;
  public tempId?: string;   // ✅ add this for optimistic messages

  private _from: string;
  private _to: string;
  private _text: string;
  private _state: string;
  private _createdAt: Date;
  private _image: string;
  private _type: string;
  public   status?: 'pending' | 'accepted' | 'cancelled';
  public productId?: string; // Property to store product ID
  public product?: Product;  // Property to store product details
  public safeImage?: SafeUrl; // sanitized image

  constructor() {}

  initialize(message: any) {
    console.log('Initializing message:', message);

    this._id = message._id || message.id;
    this.tempId = message.tempId; // ✅ keep tempId if provided

    (this as any).id = this._id;  // Force id to exist at top level

    this.from = message.from;
    this.to = message.to;
    this.text = message.text;
    this.createdAt = new Date(message.createdAt);
    this.image = message.image;
    this.state = message.state;
    this.type = message.type;
    this.status = message.status || 'pending';

    // Initialize productId and product based on the message type
    if (this.type === 'product') {
      this.productId = message.productId || null;
      this.product = message.product
        ? new Product().initialize(message.product)
        : null;
    } else {
      this.productId = null;
      this.product = null;
    }

    return this;
  }

  get id(): string {
    return this._id;
  }
  get from(): string {
    return this._from;
  }
  get to(): string {
    return this._to;
  }
  get text(): string {
    return this._text;
  }
  get state(): string {
    return this._state;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get image(): string {
    return this._image;
  }
  get type(): string {
    return this._type;
  }

  set id(id: string) {
    this._id = id;
  }
  set from(from: string) {
    this._from = from;
  }
  set to(to: string) {
    this._to = to;
  }
  set text(text: string) {
    this._text = text;
  }
  set state(state: string) {
    this._state = state;
  }
  set createdAt(createdAt: Date) {
    this._createdAt = createdAt;
  }
  set image(image: any) {
    if (!image || image === 'undefined' || image === 'null') {
      this._image = null;
    } else if (typeof image === 'string') {
      if (image.startsWith('data:image/')) {
        this._image = image; // base64
      } else if (image.startsWith('http')) {
        this._image = image; // full URL
      } else {
        this._image = constants.DOMAIN_URL + image;
      }
    } else if (typeof image === 'object' && image.path) {
      this._image = constants.DOMAIN_URL + image.path;
    } else {
      this._image = null;
    }
  }
  set type(type: string) {
    this._type = type;
  }

  isMine(id: string): boolean {
    return this.from === id;
  }
}
