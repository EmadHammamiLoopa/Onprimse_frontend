import { SharingPipeModule } from './../../../pipes/sharing/sharing-pipe.module';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { UploadFileService } from './../../../services/upload-file.service';
import { ListComponent } from './list/list.component';
import { JobComponent } from './job/job.component';
import { Camera } from '@ionic-native/camera/ngx';
import { JobFormComponent } from './job-form/job-form.component';
import { SharingModule } from './../../sharing/sharing.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { JobsPageRoutingModule } from './jobs-routing.module';

import { JobsPage } from './jobs.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    JobsPageRoutingModule,
    SharingModule,
    SharingPipeModule
  ],
  declarations: [
    JobsPage,
    JobFormComponent,
    JobComponent,
    ListComponent
  ],
  providers: [
    Camera,
    FormBuilder,
    UploadFileService,
    File,
    FilePath,
    WebView
  ]
})
export class JobsPageModule {}
