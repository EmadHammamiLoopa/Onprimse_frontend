import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { User } from './../../../models/User';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { JsonService } from 'src/app/services/json.service';
import { ListSearchComponent } from './../../list-search/list-search.component';
import { SchoolService } from './school.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { UserService } from 'src/app/services/user.service'; // Adjust the import path as needed
import { Platform } from '@ionic/angular'; // Import Platform

@Component({
  selector: 'app-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent implements OnInit {
  user: User;
  form: FormGroup;
  validationErrors = {};
  pageLoading = true;
  id: string;

  countries = [];
  selectedCountry = '';

  // fields
studyCountries: string[] = [];
selectedStudyCountry = '';


  cities = [];
  selectedCity = '';

  professions = [];
  selectedProfession = '';

  educations = [];
  selectedEducation = '';

  interests = [];
  selectedInterests = [];

  schools = [];
  selectedSchool = '';

  constructor(
    private formBuilder: FormBuilder,
    private modalCtrl: ModalController,
    private jsonService: JsonService,
    private nativeStorage: NativeStorage,
    private schoolService: SchoolService,
    private http: HttpClient,
    private router: Router,
    private toastController: ToastController,
    private userService: UserService, // Add this line
    private platform: Platform  // Add Platform service
  ) {}

  ngOnInit() {
    this.form = this.formBuilder.group({
      firstName: [''],
      lastName: [''],
      birthDate: ['', Validators.required], // Ensure Validators.required is set
      gender: [''],
      studyCountry: [''],            // <-- NEW
      school: [''],
      education: [''],
      country: [''],
      city: [''],
      profession: [''],
      interests: [''],
      aboutMe: ['']  // Add this line
    });
  
    this.loadUserData();
    this.loadJsonData();
  }

  loadUserData() {
    if (this.platform.is('cordova')) {
      console.log('Checking platform: cordova');
      this.nativeStorage.getItem('user')
        .then(user => {
          console.log('Fetched user data from NativeStorage:', user);
          if (user) {
            this.user = new User().initialize(user);
            this.populateForm();
            this.fetchUserProfileDirectly();
          } else {
            this.loadUserDataFromLocalStorage();
          }
        })
        .catch((error) => {
          console.warn('NativeStorage not available, using localStorage fallback', error);
          this.loadUserDataFromLocalStorage();
        });
    } else {
      console.log('Checking platform: not cordova');
      this.loadUserDataFromLocalStorage();
    }
  }

  loadUserDataFromLocalStorage() {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log('Fetched user data from localStorage:', user);
    if (user) {
      this.user = new User().initialize(user);
      this.populateForm();
      this.fetchUserProfileDirectly();
    } else {
      console.log('User data not found in localStorage');
    }
  }

  populateForm() {
    console.log('Populating form with user data:', this.user);

    if (this.user) {
      this.form.patchValue({
        firstName: this.user.firstName,
        lastName: this.user.lastName,
        birthDate: this.user.birthDate ? this.user.birthDate.toISOString().substring(0, 10) : '',
        gender: this.user.gender,
        studyCountry: (this.user as any).studyCountry || '',   // <-- NEW (if available)
        country: this.user.country,
        city: this.user.city,
        school: this.user.school,
        education: this.user.education,
        profession: this.user.profession,
        interests: this.user.interests,
        aboutMe: this.user.aboutMe  // Add this line
      });

      this.selectedCountry = this.user.country;
      this.selectedCity = this.user.city;
      this.selectedProfession = this.user.profession;
      this.selectedInterests = this.user.interests || [];
      this.selectedStudyCountry = (this.user as any).studyCountry || '';
      if (this.selectedStudyCountry) {
        this.loadUniversities();
      }
    }
    
    this.pageLoading = false;
    // Save the user data to localStorage to ensure it persists
    localStorage.setItem('user', JSON.stringify(this.user));
  }

  loadJsonData() {
    this.jsonService.getCountries().then(
      (resp: any) => {
        if (Array.isArray(resp)) {
          this.countries = resp;
        } else {
          this.countries = Object.keys(resp).map(key => ({ name: key, values: resp[key] }));
        }
        // reuse the same list for study countries
        this.studyCountries = Array.isArray(this.countries)
          ? this.countries.map((c: any) => (c.name ?? c)) // normalize to names
          : [];
      },
      (error) => console.error('Error fetching countries:', error)
    );

    this.jsonService.getProfessions().then(
      (resp: any) => {
        this.professions = resp;
      },
      (error) => {
        console.error('Error fetching professions:', error);
      }
    );

    this.jsonService.getEducations().then(
      (resp: any) => {
        this.educations = resp;
      },
      (error) => {
        console.error('Error fetching educations:', error);
      }
    );

    this.jsonService.getInterests().then(
      (resp: any) => {
        this.interests = resp;
      },
      (error) => {
        console.error('Error fetching interests:', error);
      }
    );
  }

  loadUniversities() {
    if (!this.selectedStudyCountry) {
      this.schools = [];
      return;
    }
    this.schoolService.getUniversityNames(this.selectedStudyCountry).subscribe((names: string[]) => {
      this.schools = names;
    });
  }
  

  async presentModal(data: any[], title: string, multiSelect: boolean = false) {
    let modalData = data;

    if (!Array.isArray(data)) {
      modalData = Object.keys(data).map(key => ({ name: key, values: data[key] }));
    }

    const modal = await this.modalCtrl.create({
      component: ListSearchComponent,
      componentProps: { data: modalData, title, multiSelect }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        if (title === 'Countries') {
          this.selectedCountry = result.data.name;
          this.cities = result.data.values;
        } else if (title === 'Cities') {
          this.selectedCity = result.data;
        } else if (title === 'Professions') {
          this.selectedProfession = result.data;
        } else if (title === 'Interests') {
          this.addInterests(result.data);
        } else if (title === 'Educations') {
          this.selectedEducation = result.data;
        } else if (title === 'Schools') {
          this.selectedSchool = result.data;
        }
      }
    });

    return await modal.present();
  }

  addInterests(interests) {
    interests.forEach(interest => {
      if (this.selectedInterests.length < 10 && !this.selectedInterests.includes(interest)) {
        this.selectedInterests.push(interest);
      }
    });
  }

  removeInterest(index: number) {
    this.selectedInterests.splice(index, 1);
  }

  async presentCountriesModal() {
    await this.presentModal(this.countries, 'Countries');
  }

  async presentCitiesModal() {
    if (this.selectedCountry) {
      await this.presentModal(this.cities, 'Cities');
    } else {
      console.warn('Please select a country first');
    }
  }

  async presentProfessionsModal() {
    await this.presentModal(this.professions, 'Professions');
  }

  async presentInterestsModal() {
    await this.presentModal(this.interests, 'Interests', true);
  }

  async presentSchoolsModal() {
    await this.presentModal(this.schools, 'Schools');
  }

  getMaxBirthDate(): string {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()); // Exact date 18 years ago
    return maxDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  }
  
  

  fetchUserProfileDirectly() {
    const userId = this.user.id;
    this.userService.getUserProfile(userId).subscribe(
      (response) => {
        console.log('Profile Response:', response);
        if (response) {
          this.user = new User().initialize(response);
          this.populateForm();
          localStorage.setItem('user', JSON.stringify(this.user)); // Save to local storage
        } else {
          console.error('User data not available in response');
        }
      },
      (error) => {
        console.error('Error fetching profile:', error);
        this.handleError(error);  // Custom error handling method
      }
    );
  }

  handleError(error: any) {
    if (error.status === 404) {
      console.error('Profile not found (404):', error.message);
    } else if (error.status === 500) {
      console.error('Server error (500):', error.message);
    } else {
      console.error('Unknown error:', error);
    }
  }

  submit() {
    if (this.form.valid) {
      const formData = this.form.getRawValue();
      console.log('Form Data:', formData);
  
      const userId = this.user.id;
      if (!userId) {
        console.error('User ID is not defined');
        return;
      }
  
      // Construct updatedUserData with non-empty fields from formData
      const updatedUserData = {
        ...this.user.toObject(),
        ...formData
      };
  
      console.log('Updating user with ID: ', userId);
      this.userService.updateUser(userId, updatedUserData).subscribe({
        next: (response) => {
          console.log('Update Response:', response);
  
          if (response && response.data) {
            // Initialize user with updated data
            this.user = new User().initialize(response.data);
  
            this.toastController.create({
              message: 'Profile updated successfully',
              duration: 2000,
              color: 'success'
            }).then(toast => toast.present());
  
            localStorage.setItem('user', JSON.stringify(this.user));
  
            this.router.navigate(['/tabs/profile/display/null']);
          } else {
            console.error('User data not available in response');
            // Handle the case where user data is not available
            this.toastController.create({
              message: 'Error fetching updated profile data',
              duration: 2000,
              color: 'danger'
            }).then(toast => toast.present());
          }
        },
        error: (error) => {
          console.error('Error updating profile:', error);
  
          // Log detailed error information
          if (error.status) {
            console.error(`Error Status: ${error.status}`);
          }
          if (error.message) {
            console.error(`Error Message: ${error.message}`);
          }
          if (error.error) {
            console.error(`Error Details:`, error.error);
          }
  
          this.toastController.create({
            message: 'Error updating profile. Please check the console for details.',
            duration: 2000,
            color: 'danger'
          }).then(toast => toast.present());
        }
      });
    } else {
      console.log('Form is invalid');
      // Handle invalid form submission as needed
    }
  }
  

  hasProfileChanged(formData: any): boolean {
    return (
      formData.firstName !== this.user.firstName ||
      formData.lastName !== this.user.lastName ||
      formData.birthDate !== this.user.birthDate ||
      formData.gender !== this.user.gender ||
      formData.education !== this.user.education ||
      formData.school !== this.user.school ||
      formData.country !== this.user.country ||
      formData.city !== this.user.city ||
      formData.aboutMe !== this.user.aboutMe // Add this line
    );
  }

  get firstName() { return this.form.get('firstName'); }
  get lastName() { return this.form.get('lastName'); }
  get birthDate() { return this.form.get('birthDate'); }
  get gender() { return this.form.get('gender'); }
  get school() { return this.form.get('school'); }
  get education() { return this.form.get('education'); }
  get aboutMe() { return this.form.get('aboutMe'); }  // Add this line

  getMaxDate() {
    return new Date().toISOString().split('T')[0];
  }
}
