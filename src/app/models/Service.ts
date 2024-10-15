import constants from '../helpers/constants';
import { User } from './User';

export class Service {

  private _id: string;
  private _title: string;
  private _description: string;
  private _company: string;
  private _phone: string;
  private _country: string;
  private _city: string;
  private _state: string;
  private _photo: string;
  private _createdAt: Date;
  private _user: User;

  // New fields
  private _serviceCategory: string;
  private _serviceRate: string;
  private _availability: string;
  private _Experience: string;
  private _serviceDuration: string;
  private _paymentMethods: string[];
  private _licenseCertification: string;
  private _websitePortfolio: string;

  constructor(service: Service) {
    this.id = service._id;
    this.title = service.title;
    this.description = service.description;
    this.company = service.company;
    this.phone = service.phone;
    this.country = service.country;
    this.city = service.city;
    this.state = service.state;
    this.photo = service.photo;
    this.user = service.user;
    this.createdAt = new Date(service.createdAt);

    // Initialize new fields
    this.serviceCategory = service.serviceCategory;
    this.serviceRate = service.serviceRate;
    this.availability = service.availability;
    this.Experience = service.Experience;
    this.serviceDuration = service.serviceDuration;
    this.paymentMethods = service.paymentMethods;
    this.licenseCertification = service.licenseCertification;
    this.websitePortfolio = service.websitePortfolio;
  }

  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get description(): string { return this._description; }
  get company(): string { return this._company; }
  get phone(): string { return this._phone; }
  get country(): string { return this._country; }
  get city(): string { return this._city; }
  get state(): string { return this._state; }
  get user(): User { return this._user; }
  get photo(): string { return this._photo; }
  get createdAt(): Date { return this._createdAt; }

  // New field getters
  get serviceCategory(): string { return this._serviceCategory; }
  get serviceRate(): string { return this._serviceRate; }
  get availability(): string { return this._availability; }
  get Experience(): string { return this._Experience; }
  get serviceDuration(): string { return this._serviceDuration; }
  get paymentMethods(): string[] { return this._paymentMethods; }
  get licenseCertification(): string { return this._licenseCertification; }
  get websitePortfolio(): string { return this._websitePortfolio; }

  set id(id: string) { this._id = id; }
  set title(title: string) { this._title = title; }
  set description(description: string) { this._description = description; }
  set company(company: string) { this._company = company; }
  set phone(phone: string) { this._phone = phone; }
  set country(country: string) { this._country = country; }
  set city(city: string) { this._city = city; }
  set state(state: string) { this._state = state; }
  set user(user: User) {
    if (user) {
      if (typeof user == 'string') {
        this._user = new User();
        this._user.id = user;
      } else {
        this._user = new User().initialize(user);
      }
    }
  }
  set photo(photo: string) {
    this._photo = (!photo.includes(constants.DOMAIN_URL) ? constants.DOMAIN_URL : '') + photo;
  }
  set createdAt(createdAt: Date) { this._createdAt = createdAt; }

  // New field setters
  set serviceCategory(serviceCategory: string) { this._serviceCategory = serviceCategory; }
  set serviceRate(serviceRate: string) { this._serviceRate = serviceRate; }
  set availability(availability: string) { this._availability = availability; }
  set Experience(Experience: string) { this._Experience = Experience; }
  set serviceDuration(serviceDuration: string) { this._serviceDuration = serviceDuration; }
  set paymentMethods(paymentMethods: string[]) { this._paymentMethods = paymentMethods; }
  set licenseCertification(licenseCertification: string) { this._licenseCertification = licenseCertification; }
  set websitePortfolio(websitePortfolio: string) { this._websitePortfolio = websitePortfolio; }
}
