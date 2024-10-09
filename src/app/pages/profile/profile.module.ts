import { FilePath } from '@ionic-native/file-path/ngx';
import { UploadFileService } from './../../services/upload-file.service';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { SharingModule } from './../sharing/sharing.module';
import { Camera } from '@ionic-native/camera/ngx';
import { DisplayComponent } from './display/display.component';
import { FormComponent } from './form/form.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { File } from '@ionic-native/file/ngx'

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SharingModule,
    ProfilePageRoutingModule
  ],
  declarations: [
    ProfilePage,
    FormComponent,
    DisplayComponent,
  ],
  providers: [
    Camera,
    NativeStorage,
    UploadFileService,
    FilePath,
    File,
    FormBuilder
  ]
})
export class ProfilePageModule {}
