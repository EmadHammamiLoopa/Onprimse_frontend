import constants from '../helpers/constants';
import { User } from './User';

export class Job {

  private _id: string;
  private _title: string;
  private _description: string;
  private _company: string;
  private _email: string;
  private _country: string;
  private _city: string;
  private _enabled: boolean;
  private _photo: string;
  private _createdAt: Date;
  private _user: User;
  private _jobType: string;
  private _minSalary: number;  // New
  private _maxSalary: number;  // New
  private _experienceLevel: string;
  private _jobCategory: string;
  private _remoteOption: string;
  private _applicationDeadline: Date;
  private _jobRequirements: string;
  private _jobBenefits: string;
  private _educationLevel: string;
  private _industry: string;
  private _website: string;
  private _jobLocationType: string;
  private _address: string;


  
  constructor(job: Job) {
    this.id = job._id;
    this.title = job.title;
    this.description = job.description;
    this.company = job.company;
    this.email = job.email;
    this.country = job.country;
    this.city = job.city;
    this.address=job.address;
    this.enabled = job.enabled;
    this.photo = job.photo;
    this.user = job.user;
    this.createdAt = new Date(job.createdAt);
    this.jobType = job.jobType;
    this.minSalary = job.minSalary;  // Set minSalary
    this.maxSalary = job.maxSalary;  // Set maxSalary
    this.experienceLevel = job.experienceLevel;
    this.jobCategory = job.jobCategory;
    this.remoteOption = job.remoteOption;
    this.applicationDeadline = new Date(job.applicationDeadline);
    this.jobRequirements = job.jobRequirements;
    this.jobBenefits = job.jobBenefits;
    this.educationLevel = job.educationLevel;
    this.industry = job.industry;
    this.website = job.website;
    this.jobLocationType = job.jobLocationType;
  }

  get id(): string { return this._id }
  get title(): string { return this._title }
  get description(): string { return this._description }
  get company(): string { return this._company }
  get email(): string { return this._email }
  get country(): string { return this._country }
  get city(): string { return this._city }
  get address(): string { return this._address }


  
  get enabled(): boolean { return this._enabled }
  get user(): User { return this._user }
  get photo(): string { return this._photo }
  get createdAt(): Date { return this._createdAt }
  get jobType(): string { return this._jobType }
  get minSalary(): number { return this._minSalary; }
  get maxSalary(): number { return this._maxSalary; }
  get experienceLevel(): string { return this._experienceLevel }
  get jobCategory(): string { return this._jobCategory }
  get remoteOption(): string { return this._remoteOption }
  get applicationDeadline(): Date { return this._applicationDeadline }
  get jobRequirements(): string { return this._jobRequirements }
  get jobBenefits(): string { return this._jobBenefits }
  get educationLevel(): string { return this._educationLevel }
  get industry(): string { return this._industry }
  get website(): string { return this._website }
  get jobLocationType(): string { return this._jobLocationType }

  set id(id: string) { this._id = id }
  set title(title: string) { this._title = title }
  set description(description: string) { this._description = description }
  set company(company: string) { this._company = company }
  set email(email: string) { this._email = email }
  set country(country: string) { this._country = country }
  set city(city: string) { this._city = city }
  set address(address: string) { this._address = address }


  
  set enabled(enabled: boolean) { this._enabled = enabled }
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
  set createdAt(createdAt: Date) { this._createdAt = createdAt }
  set jobType(jobType: string) { this._jobType = jobType }
  set minSalary(minSalary: number) { this._minSalary = minSalary; }
  set maxSalary(maxSalary: number) { this._maxSalary = maxSalary; }
  set experienceLevel(experienceLevel: string) { this._experienceLevel = experienceLevel }
  set jobCategory(jobCategory: string) { this._jobCategory = jobCategory }
  set remoteOption(remoteOption: string) { this._remoteOption = remoteOption }
  set applicationDeadline(applicationDeadline: Date) { this._applicationDeadline = applicationDeadline }
  set jobRequirements(jobRequirements: string) { this._jobRequirements = jobRequirements }
  set jobBenefits(jobBenefits: string) { this._jobBenefits = jobBenefits }
  set educationLevel(educationLevel: string) { this._educationLevel = educationLevel }
  set industry(industry: string) { this._industry = industry }
  set website(website: string) { this._website = website }
  set jobLocationType(jobLocationType: string) { this._jobLocationType = jobLocationType }
}
