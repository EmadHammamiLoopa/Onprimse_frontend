import { SharingPipeModule } from './../../../pipes/sharing/sharing-pipe.module';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { UploadFileService } from './../../../services/upload-file.service';
import { Camera } from '@ionic-native/camera/ngx';
import { ServiceFormComponent } from './service-form/service-form.component';
import { ListComponent } from './list/list.component';
import { ServiceComponent } from './service/service.component';
import { SharingModule } from './../../sharing/sharing.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ServicesPageRoutingModule } from './services-routing.module';
import { ServicesPage } from './services.page';
import { CallNumber } from '@ionic-native/call-number/ngx';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    ServicesPageRoutingModule,
    SharingModule,
    SharingPipeModule
  ],
  declarations: [
    ServicesPage,
    ServiceComponent,
    ListComponent,
    ServiceFormComponent
  ],
  providers: [
    Camera,
    UploadFileService,
    File,
    FilePath,
    WebView,
    CallNumber
  ]
})
export class ServicesPageModule {}
