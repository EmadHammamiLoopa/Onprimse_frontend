import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { OneSignalService } from '../../../services/one-signal.service';
import { User } from '../../../models/User';
import { ModalController } from '@ionic/angular';
import { WelcomeAlertComponent } from '../welcome-alert/welcome-alert.component';
import { SocketService } from 'src/app/services/socket.service';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.scss'],
})
export class SigninComponent implements OnInit {
  form: FormGroup;
  pageLoading = false;
  validationErrors = {};
  user: User;

  constructor(
    private formBuilder: FormBuilder,
    private auth: AuthService,
    private toastService: ToastService,
    private router: Router,
    private nativeStorage: NativeStorage,
    private oneSignalService: OneSignalService,
    private modalCtrl: ModalController,
    private platform: Platform,
    private socketService: SocketService  // <-- Inject WebSocket Service here
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  ionViewWillEnter() {
    this.clearForm();
  }

  initializeForm() {
    this.form = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  clearForm() {
    this.form.patchValue({
      email: '',
      password: '',
    });
  }

  async submit() {
    this.pageLoading = true;
    console.log('Submit clicked, form values:', this.form.value);
  
    try {
      const resp = await this.auth.signin({
        email: this.form.value.email,
        password: this.form.value.password,
      });
    
      console.log('Sign-in response:', resp);
      this.pageLoading = false;
      this.user = new User().initialize(resp.data.user);
    
      await this.storeUserData(resp.data.token, resp.data.user);
    
      // ✅ 1️⃣ Initialize Socket first (without userId)
      try {
        await SocketService.initializeSocket();
        console.log('✅ WebSocket initialized successfully');
    
        // ✅ 2️⃣ Then register the user after connection established
        await SocketService.initializeSocket(); // after you store token
        SocketService.bindToAuthUser();         // no params

        // ✅ 3️⃣ Optional: check if socket instance is live
        const socket = await SocketService.getSocket();
        console.log('✅ WebSocket instance retrieved:', socket.id);
      } catch (error) {
        console.error('❌ WebSocket initialization failed:', error);
      }
    
      if (!this.user.loggedIn) {
        await this.showWelcomeAlert();
      }
    
      this.router.navigate(['/tabs/new-friends']);
    }  catch (err) {
      this.pageLoading = false;
      console.error('Sign-in error:', err);
      if (err && err.errors) {
        this.validationErrors = err.errors;
      } else if (typeof err === 'string') {
        this.toastService.presentStdToastr(err);
      } else {
        this.toastService.presentStdToastr('An unexpected error occurred.');
      }
    }
  }
  

  private async storeUserData(token: string, user: any) {
    console.log('Storing user data');
    const userData = JSON.stringify(user); // Convert user data to JSON string

    if (this.platform.is('cordova')) {
      await this.nativeStorage.setItem('token', token);
      await this.nativeStorage.setItem('user', userData);
    } else {
      console.log('Storing token and user data in localStorage');
      localStorage.setItem('token', token);
      localStorage.setItem('user', userData);
    }
  }

  async showWelcomeAlert() {
    console.log('Showing welcome alert');
    const modal = await this.modalCtrl.create({
      component: WelcomeAlertComponent,
      componentProps: {
        user: this.user,
      },
      animated: true,
      showBackdrop: true,
    });
    await modal.present();
  }

  // Google Sign-in method
  async googleSignin() {
    try {
      const resp = await this.auth.googleSignIn();
      console.log('Google Sign-In response:', resp);
      this.pageLoading = false;
      this.user = new User().initialize(resp.data.user);
  
      await this.storeUserData(resp.data.token, resp.data.user);
  
      // ✅ 1️⃣ Initialize Socket first (without userId)
      await SocketService.initializeSocket();
      console.log('✅ WebSocket initialized successfully');
  
      // ✅ 2️⃣ Register the user after connection established
  await SocketService.initializeSocket(); // after you store token
  SocketService.bindToAuthUser();         // no params  
      // ✅ 3️⃣ Optional: Check if socket instance is live
      const socket = await SocketService.getSocket();
      console.log('✅ WebSocket instance retrieved:', socket.id);
  
      if (!this.user.loggedIn) {
        await this.showWelcomeAlert();
      }
  
      this.router.navigate(['/tabs/new-friends']);
    } catch (err) {
      this.pageLoading = false;
      console.error('Google Sign-In error:', err);
      if (err && err.errors) {
        this.validationErrors = err.errors;
      } else if (typeof err === 'string') {
        this.toastService.presentStdToastr(err);
      } else {
        this.toastService.presentStdToastr('An unexpected error occurred.');
      }
    }
  }
  
}