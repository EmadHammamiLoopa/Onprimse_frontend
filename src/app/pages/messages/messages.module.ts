import { WebrtcService } from './../../services/webrtc.service';
import { VideoComponent } from './chat/video/video.component';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { UploadFileService } from './../../services/upload-file.service';
import { SharingPipeModule } from './../../pipes/sharing/sharing-pipe.module';
import { Camera } from '@ionic-native/camera/ngx';
import { SharingModule } from './../sharing/sharing.module';
import { ChatComponent } from './chat/chat.component';
import { ListComponent } from './list/list.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MessagesPageRoutingModule } from './messages-routing.module';

import { MessagesPage } from './messages.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MessagesPageRoutingModule,
    SharingModule,
    SharingPipeModule
  ],
  declarations: [
    MessagesPage,
    ListComponent,
  ],
  providers: [
    Camera,
    UploadFileService,
    File,
    FilePath,
    WebView,
    WebrtcService
  ]
})
export class MessagesPageModule {}
