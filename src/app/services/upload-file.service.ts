import { Injectable } from '@angular/core';
import { FilePath } from '@ionic-native/file-path/ngx';
import { Platform } from '@ionic/angular';
import { Camera, CameraOptions, PictureSourceType, MediaType } from '@ionic-native/camera/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { PermissionService } from './permission.service';
import { MockCordovaService } from './mock-cordova.service';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import constants from '../helpers/constants';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UploadFileService {

  constructor(
    private filePath: FilePath,
    private platform: Platform,
    private camera: Camera,
    private permissionService: PermissionService,
    private androidPermission: AndroidPermissions,
    private mockCordovaService: MockCordovaService,
    private http: HttpClient
  ) {}

    private apiUrl = `${environment.apiUrl}/user`;
  
  takeMedia(sourceType: number, mediaType: 'image' | 'video'): Promise<{ filePath: string, mediaType: string }> {
    const destinationType = this.camera.DestinationType.NATIVE_URI;
    const options: CameraOptions = {
      quality: 75,
      destinationType,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: (mediaType === 'video') ? this.camera.MediaType.VIDEO : this.camera.MediaType.PICTURE,
      sourceType,
      allowEdit: false,
      saveToPhotoAlbum: false,
      correctOrientation: true,
    };

    return this.platform.ready().then(() => {
      if (!this.platform.is('cordova')) {
        // Browser fallback
        return this.mockCordovaService.getPicture({ sourceType });
      }

      return new Promise((resolve, reject) => {
        const permission = sourceType === PictureSourceType.CAMERA 
            ? this.androidPermission.PERMISSION.CAMERA 
            : this.androidPermission.PERMISSION.READ_EXTERNAL_STORAGE;

        this.permissionService.getPermission(permission)
          .then(() => {
            this.camera.getPicture(options)
              .then((mediaUri) => {
                if (this.platform.is('android') && sourceType === PictureSourceType.PHOTOLIBRARY) {
                  this.filePath.resolveNativePath(mediaUri)
                    .then(filePath => resolve({ filePath, mediaType }))
                    .catch(err => reject(err));
                } else {
                  resolve({ filePath: mediaUri, mediaType });
                }
              }).catch(err => reject(err));
          }).catch(err => reject(err));
      });
    });
  }

  // Browser file picker
  getFileFromBrowser(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.onchange = () => {
        const file = input.files[0];
        if (file) resolve(file);
        else reject('No file selected');
      };
      input.click();
    });
  }

  
  upload(file: File, userId: string): Observable<any> {
    const maxSizeMB = 20;
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`File exceeds ${maxSizeMB} MB limit.`);
    }
    const formData = new FormData();
    formData.append('upload', file);
    return this.http.post(`${this.apiUrl}/${userId}/upload`, formData);


    }

  takePicture(sourceType: number, mediaType: 'image' | 'video' = 'image'): Promise<any> {
    const mediaTypeValue = (mediaType === 'image') 
      ? this.camera.MediaType.PICTURE 
      : this.camera.MediaType.VIDEO;

    const options: CameraOptions = {
      quality: 75,
      destinationType: this.camera.DestinationType.FILE_URI,
      mediaType: mediaTypeValue,
      sourceType: sourceType,
      saveToPhotoAlbum: false,
      correctOrientation: true
    };

    return this.camera.getPicture(options).then(imageData => {
      return {
        imageData: imageData,
        file: null, // you can extend this if needed for file processing
        name: imageData.substring(imageData.lastIndexOf('/') + 1)
      };
    });
  }
}