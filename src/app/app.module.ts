import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy, Platform } from '@ionic/angular';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { Network } from '@ionic-native/network/ngx';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { HTTP } from '@ionic-native/http/ngx';import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { Toast } from '@ionic-native/toast/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { OpenNativeSettings } from '@ionic-native/open-native-settings/ngx';
import { OneSignal } from '@ionic-native/onesignal/ngx';
import { Stripe } from '@ionic-native/stripe/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { File } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { AdMobFree } from '@ionic-native/admob-free/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { FormsModule, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxStripeModule } from 'ngx-stripe';

import { MockNativeStorage } from './services/mock-native-storage.service';
import { MockStatusBar } from './services/mock-status-bar.service';
import { MockSplashScreen } from './services/mock-splash-screen.service';
import { MockNetwork } from './services/mock-network.service';
import { MockAdMobFree } from './services/mock-admobfree.service';

import { UploadFileService } from './services/upload-file.service';
import { WebrtcService } from './services/webrtc.service';
import { CameraService } from './services/camera.service';
import constants from './helpers/constants';

import { SharingModule } from './pages/sharing/sharing.module';
import { SharingPipeModule } from './pipes/sharing/sharing-pipe.module';
import { ChatComponent } from './pages/messages/chat/chat.component';
import { VideoComponent } from './pages/messages/chat/video/video.component';
import { ErrorComponent } from './pages/error/error.component';
import { PrivacyPolicyComponent } from './pages/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './pages/terms-of-service/terms-of-service.component';
import { MockCordovaService } from './services/mock-cordova.service';
import { AuthGuard } from './guards/auth.guard';
import { AuthInterceptor } from '../app/guards/auth.interceptor';
import { StorageService } from './services/storage.service'; // Add StorageService
import { GooglePlus } from '@ionic-native/google-plus/ngx';
import { GoogleAuthService } from './services/GoogleAuthService';
import { EditProductComponent } from './edit-product/edit-product.component';

@NgModule({
  declarations: [
    AppComponent,
    ErrorComponent,
    ChatComponent,
    VideoComponent,
    PrivacyPolicyComponent,
    TermsOfServiceComponent,
    EditProductComponent 
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    IonicModule,
    SharingModule,
    SharingPipeModule,
    ReactiveFormsModule,
    NgxStripeModule.forRoot(constants.STRIPE_PUBLIC_KEY)
  ],
  providers: [
    { provide: NativeStorage, useClass: (typeof window !== 'undefined' && 'cordova' in window) ? NativeStorage : MockNativeStorage },
    { provide: StatusBar, useClass: (typeof window !== 'undefined' && 'cordova' in window) ? StatusBar : MockStatusBar },
    { provide: SplashScreen, useClass: (typeof window !== 'undefined' && 'cordova' in window) ? SplashScreen : MockSplashScreen },
    { provide: Network, useClass: (typeof window !== 'undefined' && 'cordova' in window) ? Network : MockNetwork },
    { provide: AdMobFree, useClass: (typeof window !== 'undefined' && 'cordova' in window) ? AdMobFree : MockAdMobFree },
    Camera,
    CameraService,
    HTTP,
    Toast,
    AndroidPermissions,
    OpenNativeSettings,
    OneSignal,
    Stripe,
    UploadFileService,
    File,
    FilePath,
    WebView,
    WebrtcService,
    FormBuilder,
    BackgroundMode,
    MockCordovaService,
    StorageService, 
    GooglePlus,

    { 
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true 
    },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }, // Ensure this is correct
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    GoogleAuthService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add this to recognize Ionic components

})
export class AppModule {}
