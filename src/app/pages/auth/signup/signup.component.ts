import { ListSearchComponent } from './../../list-search/list-search.component';
import { AuthService } from './../../../services/auth.service';
import { Router } from '@angular/router';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { TermsOfServiceComponent } from '../../terms-of-service/terms-of-service.component';
import { PrivacyPolicyComponent } from '../../privacy-policy/privacy-policy.component';
import { JsonService } from '../../../services/json.service';
import { SchoolService } from '../../profile/form/school.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent implements OnInit {

  gender = "male";
  step = 0;
  steps = ['email', 'name', 'password', 'birthDate', 'gender', 'location', 'school', 'education', 'profession', 'interests', 'aboutMe', 'randomRequests', 'ageVisibility', 'success'];
  validationErrors: any = {};
  btnLoading = false;
  pageLoading = false;
  form: FormGroup;

  countriesObject: any;
  countries: string[] = [];
  cities: string[] = [];
  selectedCountry: string = '';
  selectedCity: string = '';
  selectedInterests: string[] = [];
  studyCountries: string[] = [];
  selectedStudyCountry: string = '';
  isLoadingSchools = false;
  
  
  schools: string[] = [];
  educations: string[] = [];
  professions: string[] = [];
  interests: string[] = [];

  constructor(
    private router: Router,
    private auth: AuthService,
    private formBuilder: FormBuilder,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef,
    private modalController: ModalController,
    private nativeStorage: NativeStorage,
    private jsonService: JsonService,
    private schoolService: SchoolService,
  ) { }

  ionViewWillEnter() {
    this.step = 0;
  }

  ngOnInit() {
    this.initializeForm();
    this.loadCountries();
    this.loadEducations();
    this.loadProfessions();
    this.loadInterests();
  }

  initializeForm() {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required, Validators.minLength(8)]],
      firstName: ['', [Validators.required, Validators.pattern('[a-zA-Z-_]+'), Validators.maxLength(40)]], // Correct initialization
      lastName: ['', [Validators.required, Validators.pattern('[a-zA-Z-_]+'), Validators.maxLength(40)]], // Correct initialization
      birthDate: ['', [Validators.required]],
      receiveRandomRequests: [false],
      showAge: [false],
      gender: ['', [Validators.required]],
      studyCountry: [''],       
      school: [''],
      education: [''],
      profession: [''],
      interests: [''],
      aboutMe: ['']
    });
  }
  



  addInterests(event: Event) {
    const customEvent = event as CustomEvent<any>; // Casting event to CustomEvent
    const interests = customEvent.detail.value; // Safely accessing the detail property
  
    if (Array.isArray(interests)) { // Ensure interests is an array
      interests.forEach((interest: string) => {
        if (!this.selectedInterests.includes(interest)) {
          this.selectedInterests.push(interest);
        }
      });
    }
  }
  
  
  
  

  removeInterest(index: number) {
    this.selectedInterests.splice(index, 1);
  }

  googleSignUp() {
    console.log('Google sign-up triggered.');
  }

  async loadCountries() {
    const countries = await this.jsonService.getCountries();
    this.countriesObject = countries;
    this.countries = Object.keys(this.countriesObject);
    this.studyCountries = this.countries;

  }

  async loadEducations() {
    this.educations = await this.jsonService.getEducations();
  }

  async loadProfessions() {
    this.professions = await this.jsonService.getProfessions();
  }

  async loadInterests() {
    this.interests = await this.jsonService.getInterests();
  }

  continue() {
    if (this.steps[this.step] == 'email') this.verifyEmail();
    else if (this.step < this.steps.length - 2) {
      this.validationErrors[this.steps[this.step]] = undefined;
      this.step++;
    } else this.submit();
  }

  back() {
    if (this.step > 0) this.step--;
    else this.router.navigate(['/auth/home']);
  }

  getUserInfo() {
    return {
      firstName: this.form.get('firstName')?.value,
      lastName: this.form.get('lastName')?.value,
      email: this.form.get('email')?.value,
      password: this.form.get('password')?.value,
      password_confirmation: this.form.get('password_confirmation')?.value,
      city: this.selectedCity,
      country: this.selectedCountry,
      gender: this.gender,
      birthDate: this.form.get('birthDate')?.value,
      receiveRandomRequests: this.form.get('receiveRandomRequests')?.value,
      showAge: this.form.get('showAge')?.value,
      school: String(this.form.get('school')?.value || ''), // Ensure it's a string
      education: String(this.form.get('education')?.value || ''), // Ensure it's a string
      profession: String(this.form.get('profession')?.value || ''), // Ensure it's a string
      interests: this.selectedInterests.map(s => s.trim()).filter(Boolean),
      aboutMe: this.form.get('aboutMe')?.value
    };
  }
  

    // NEW: modal to pick country of study
    async presentStudyCountriesModal() {
      const modal = await this.modalController.create({
        component: ListSearchComponent,
        componentProps: { data: this.studyCountries, title: 'Country of Study' }
      });
      await modal.present();
      const { data } = await modal.onDidDismiss();
      if (data) {
        const country = typeof data === 'string' ? data : (data.name ?? '');
        if (country !== this.selectedStudyCountry) {
          this.selectedStudyCountry = country;
          this.form.get('studyCountry')?.setValue(country);
          this.form.get('school')?.reset('');    // clear previous choice
          this.schools = [];
          this.isLoadingSchools = true;
          this.schoolService.getUniversityNames(country).subscribe({
            next: names => { this.schools = names; this.isLoadingSchools = false; },
            error: () => { this.isLoadingSchools = false; }
          });
        }
      }
    }
    
  
    // NEW: fetch school names for selected country
    loadSchoolsForCountry(country: string) {
      this.schoolService.getUniversityNames(country).subscribe((names: string[]) => {
        this.schools = names;
      });
    }
  
    // OPTIONAL: keep a guarded version if something else calls it
    async loadSchools() {
      if (!this.selectedStudyCountry) {
        this.schools = [];
        return;
      }
      this.loadSchoolsForCountry(this.selectedStudyCountry);
    }

  backToError() {
    for (let ind = 0; ind < this.steps.length; ++ind) {
      const step = this.steps[ind];
      if (this.validationErrors[step] || (step == 'name' && (this.validationErrors['firstName'] || this.validationErrors['lastName']))) {
        this.step = ind;
        break;
      }
    }
  }

  verifyEmail() {
    this.btnLoading = true;
    this.auth.verifyEmail(this.form.get('email')?.value)
      .then((resp: any) => {
        this.btnLoading = false;
        this.cdr.detectChanges();
        if (!resp.data) ++this.step;
        else this.validationErrors['email'] = ['this email is already exists'];
      }, err => {
        this.btnLoading = false;
        if (err.errors) this.validationErrors = err.errors;
      });
  }

  submit() {
    this.pageLoading = true;
    this.validationErrors = {};
    this.auth.signup(this.getUserInfo())
      .then(resp => {
        this.pageLoading = false;
        this.step++;
      }, err => {
        this.pageLoading = false;
        if (err.errors) {
          this.validationErrors = err.errors;
          this.backToError();
        }
      });
  }

  isValid() {
    if (this.steps[this.step] == 'name') {
      return this.form.get('firstName')?.valid && this.form.get('lastName')?.valid;
    } else if (this.steps[this.step] == 'password') {
      return this.form.get('password')?.valid && this.form.get('password')?.value === this.form.get('password_confirmation')?.value;
    } else if (this.steps[this.step] == 'location') {
      return this.selectedCountry && this.selectedCity;
    } else if (this.steps[this.step] == 'randomRequests' || this.steps[this.step] == 'ageVisibility') {
      return true;
    } else if (this.steps[this.step] != 'gender') {
      return this.form.get(this.steps[this.step])?.valid;
    }
    return true;
  }

  async presentCountriesModal() {
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: { data: this.countries, title: 'Countries' }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
  
    if (data !== undefined && data !== null) {
      const picked = typeof data === 'string' ? data : (data.name ?? '');
      const country = (picked || '').trim();  // normalize
  
      // Only update if changed
      if (country !== (this.selectedCountry || '')) {
        this.selectedCountry = country;
        this.cities = this.countriesObject[this.selectedCountry] || [];
        this.selectedCity = ''; // reset so City placeholder shows
      }
    }
  }
  
  

  async presentCitiesModal() {
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: {
        data: this.cities,
        title: 'Cities'
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.selectedCity = data;
    }
  }

  async presentSchoolsModal() {
    if (!this.selectedStudyCountry || this.isLoadingSchools || !this.schools.length) return;
  
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: { data: [...this.schools], title: 'Select University' } // pass a copy
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.form.get('school')?.setValue(data);
  }

  async presentEducationsModal() {
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: {
        data: this.educations,
        title: 'Educations'
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.form.get('education')?.setValue(data);
    }
  }

  async presentProfessionsModal() {
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: {
        data: this.professions,
        title: 'Professions'
      }
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.form.get('profession')?.setValue(data);
    }
  }

  async presentInterestsModal() {
    const modal = await this.modalController.create({
      component: ListSearchComponent,
      componentProps: {
        data: this.interests,
        title: 'Interests',
        multiSelect: true
      }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.addInterests(result.data);
      }
    });

    await modal.present();
  }

  getMaxDate() {
    const currDate = new Date();
    currDate.setFullYear(currDate.getFullYear() - 18);
    return currDate.toJSON().slice(0, 10);
  }

  async openPrivacyPolicy() {
    const modal = await this.modalCtrl.create({
      component: PrivacyPolicyComponent
    });

    await modal.present();
  }

  async openTermsOfService() {
    const modal = await this.modalCtrl.create({
      component: TermsOfServiceComponent
    });

    await modal.present();
  }
}
