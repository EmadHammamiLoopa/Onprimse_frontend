import { Router } from '@angular/router';
import { UploadFileService } from './../../../../services/upload-file.service';
import { ServiceService } from './../../../../services/service.service';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { ToastService } from './../../../../services/toast.service';
import { Camera } from '@ionic-native/camera/ngx';
import { Component, OnInit } from '@angular/core';
import { ListSearchComponent } from 'src/app/pages/list-search/list-search.component';
import { ModalController, Platform } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { AdMobFeeService } from './../../../../services/admobfree.service';
import { User } from './../../../../models/User';
import { JsonService } from './../../../../services/json.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-service-form',
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.scss'],
})
export class ServiceFormComponent implements OnInit {

  countriesObject = {};
  countries: string[] = [];
  cities: string[] = [];
  selectedCountry: string;
  selectedCity: string;
  user: User;

  pageLoading = false;
  serviceImage = {
    url: "",
    file: null,
    name: ''
  };
  validatorErrors = {};
  form: FormGroup;
  imageLoading = false;

  get title() {
    return this.form.get('title');
  }

  get company() {
    return this.form.get('company');
  }

  get phone() {
    return this.form.get('phone');
  }

  get description() {
    return this.form.get('description');
  }

  constructor(private camera: Camera, private formBuilder: FormBuilder, private uploadFile: UploadFileService, private modalController: ModalController,
              private toastService: ToastService, private webView: WebView, private serviceService: ServiceService, private nativeStorage: NativeStorage,
              private router: Router, private adMobFeeService: AdMobFeeService, private platform: Platform, private jsonService: JsonService,
              private sanitizer: DomSanitizer) { }

ngOnInit() {
  this.initializeForm();
  this.getUserData();
  this.loadCountryData();

  // Watch for changes in the company/individual select control
  this.form.get('company').valueChanges.subscribe((value) => {
    this.onCompanySelectionChange(value);
  });
}

onCompanySelectionChange(value: string) {
  if (value === 'Company') {
    this.form.addControl('companyName', new FormControl('', Validators.required));
  } else {
    this.form.removeControl('companyName');
    this.form.patchValue({ companyName: 'Individual' }); // Default value for individual
  }
}

  initializeForm() {
    this.form = this.formBuilder.group({
      title: ['', [Validators.required, Validators.maxLength(50)]],
      company: ['', [Validators.required, Validators.maxLength(50)]],
      phone: ['', [Validators.required, Validators.pattern("^[+]?[(]?[0-9]{3}[)]?[- \.]?[0-9]{3}[- \.]?[0-9]{4,6}$"), Validators.maxLength(20)]],
      serviceCategory: ['', [Validators.required]],
      serviceRate: ['', [Validators.required]],
      availability: ['', [Validators.required]],
      Experience: ['', [Validators.required]],
      serviceDuration: ['', [Validators.required]],
      paymentMethods: ['', [Validators.required]],
      licenseCertification: ['', [Validators.maxLength(100)]],
      websitePortfolio: ['', [Validators.pattern('https?://.+')]],
      address: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.maxLength(255)]]
    });
    
 
    this.loadCountryData(); // Load countries when initializing the form
  }

  getUserData() {
    if (this.platform.is('cordova')) {
      this.nativeStorage.getItem('user')
        .then(
          user => {
            console.log('Fetched user data from NativeStorage:', user);
            this.initializeUser(user);
          }
        )
        .catch(error => {
          console.warn('Error fetching user data from NativeStorage:', error);
          this.fetchUserFromLocalStorage();
        });
    } else {
      this.fetchUserFromLocalStorage();
    }
  }

  fetchUserFromLocalStorage() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      console.log('Fetched user data from localStorage:', user);
      this.initializeUser(user);
    } else {
      console.log('User data not found in localStorage');
      this.toastService.presentStdToastr('User data not found. Please log in again.');
      this.router.navigateByUrl('/auth/signin');
    }
  }

  initializeUser(user: any) {
    if (user) {
      this.user = new User().initialize(user);
      console.log('User initialized successfully:', this.user);
    } else {
      console.error('Invalid user data:', user);
    }
  }

  async loadCountryData() {
    try {
      const resp = await this.jsonService.getCountries();
      if (Array.isArray(resp)) {
        this.countries = resp;
      } else {
        this.countriesObject = resp;
        this.countries = Object.keys(this.countriesObject);
      }
      console.log('Countries fetched:', this.countries);
    } catch (err) {
      console.error('Failed to load countries:', err);
    }
  }
  

  pickImage() {
    this.imageLoading = true;
    this.uploadFile.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY)
      .then(
        (resp: any) => {
          this.imageLoading = false;
          if (this.platform.is('cordova')) {
            this.serviceImage = {
              url: this.sanitizer.bypassSecurityTrustUrl(this.webView.convertFileSrc(resp.imageData)) as string,
              file: resp.file,
              name: resp.name
            };
          } else {
            this.serviceImage = {
              url: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(resp.file)) as string,
              file: resp.file,
              name: resp.name
            };
          }
        },
        err => {
          this.imageLoading = false;
          this.toastService.presentStdToastr(err);
        }
      );
  }

  getServiceForm() {
    const form: FormData = new FormData();
    form.append('title', this.title.value);
    form.append('company', this.company.value); // This will be overwritten later if company is selected
    form.append('phone', this.phone.value);
    form.append('country', this.selectedCountry);
    form.append('city', this.selectedCity);
    form.append('description', this.description.value);
    form.append('serviceCategory', this.form.get('serviceCategory').value);  // New field
    form.append('serviceRate', this.form.get('serviceRate').value);          // New field
    form.append('availability', this.form.get('availability').value);        // New field
    form.append('Experience', this.form.get('Experience').value);          // New field
    form.append('serviceDuration', this.form.get('serviceDuration').value);  // New field
    form.append('paymentMethods', JSON.stringify(this.form.get('paymentMethods').value));
    form.append('licenseCertification', this.form.get('licenseCertification').value);      // New field
    form.append('websitePortfolio', this.form.get('websitePortfolio').value);              // New field
    form.append('address', this.form.get('address').value);                  // New field
    form.append('photo', this.serviceImage.file, this.serviceImage.name);
    return form;
  }
  

  clearServiceForm() {
    this.form.patchValue({
      title: '',
      description: '',
      company: '',
      phone: ''
    });
    this.serviceImage = {
      url: "",
      file: null,
      name: ''
    };
  }
  submit() {
    // Ensure an image is selected
    if (!this.serviceImage.file) {
      this.toastService.presentStdToastr('Please select an image for the service');
      return;
    }
  
    // Ensure the form is valid
    if (this.form.invalid) {
      this.toastService.presentStdToastr('Please fill in all required fields');
      return;
    }
  
    this.validatorErrors = {};
    this.pageLoading = true;
  
    // Prepare the form data for submission
    const formData = this.getServiceForm();
  
    // Handle company and companyName fields
    if (this.form.get('company').value === 'Company') {
      // Set the company name from the input
      formData.set('company', this.form.get('companyName').value); // Use the companyName field
    } else {
      // If individual is selected, set company to 'Individual'
      formData.set('company', 'Individual');
    }
  
    // Submit the form data
    this.serviceService.store(formData)
      .then(
        resp => {
          this.pageLoading = false;
          console.log(resp);
          this.toastService.presentStdToastr('Service created successfully');
          this.router.navigateByUrl('/tabs/small-business/services');
          this.clearServiceForm();  // Reset the form after success
        },
        err => {
          this.pageLoading = false;
          if (err.errors) {
            this.validatorErrors = err.errors;  // Display validation errors if any
          }
          if (typeof err === 'string') {
            this.toastService.presentStdToastr(err);
          }
          console.log(err);
        }
      );
  }
  
  
  
  async presentCountriesModal() {
    const result = await this.presentSearchListModal(this.countries, 'Countries');
    if (result) {
      this.selectedCountry = result;
      this.cities = this.countriesObject[this.selectedCountry];
    }
  }
  
  async presentCitiesModal() {
    const result = await this.presentSearchListModal(this.cities, 'Cities');
    if (result) {
      this.selectedCity = result;
    }
  }

  async presentSearchListModal(list: any, title: string) {
    const modal = await this.modalController.create({
      componentProps: {
        data: list,
        title
      },
      component: ListSearchComponent
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data;
  }

  isFormValid(form) {
    return !form.valid || !this.selectedCountry || !this.selectedCity;
  }
}
