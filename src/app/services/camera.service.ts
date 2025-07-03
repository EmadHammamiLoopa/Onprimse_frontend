import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';
import { File, FileEntry, IFile } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  constructor(
    private platform: Platform,
    private camera: Camera,
    private file: File,
    private filePath: FilePath
  ) {}

  getPictureSourceType(): typeof PictureSourceType {
    return this.camera.PictureSourceType;
  }

  async takePicture(sourceType: PictureSourceType): Promise<any> {
    if (!this.platform.is('cordova')) {
      console.warn('Cordova not available, using browser fallback');
      return this.takePictureWithBrowser();
    }

    const options: CameraOptions = {
      quality: 100,
      destinationType: this.camera.DestinationType.FILE_URI,
      sourceType,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE
    };

    try {
      const imageData = await this.camera.getPicture(options);
      console.log('Picture taken:', imageData);
      if (this.platform.is('cordova') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
        const filePath = await this.filePath.resolveNativePath(imageData);
        return this.readImgSrc(filePath);
      } else {
        return this.readImgSrc(imageData);
      }
    } catch (error) {
      console.error('Camera getPicture error:', error);
      throw error;
    }
  }

  private readImgSrc(imageData: string): Promise<any> {
    if (!this.platform.is('cordova')) {
      console.warn('Cordova not available, cannot read image source');
      return Promise.reject('Cordova not available');
    }

    return new Promise((resolve, reject) => {
      this.file.resolveLocalFilesystemUrl(imageData).then((fileEntry: FileEntry) => {
        console.log('Resolved file entry:', fileEntry);
        fileEntry.file(file => {
          resolve(this.generateBlobImg(file, imageData));
        }, err => {
          console.error('Error getting file:', err);
          reject(err);
        });
      }, err => {
        console.error('Error resolving file system URL:', err);
        reject(err);
      });
    });
  }

  private generateBlobImg(file: IFile, imageData: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const fileName = file.name.substring(0, file.name.lastIndexOf('.') + 1) + 'jpg';
      const fileType = file.type;
      const fileReader = new FileReader();

      fileReader.readAsArrayBuffer(file as unknown as Blob);
      fileReader.onload = () => {
        const imgBlob = new Blob([fileReader.result as ArrayBuffer], { type: fileType });
        console.log('Generated blob image:', imgBlob);
        resolve({ file: imgBlob, name: fileName, imageData });
      };
      fileReader.onerror = error => {
        console.error('FileReader error:', error);
        reject(error);
      };
    });
  }

  private takePictureWithBrowser(): Promise<any> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event: any) => {
        const file = event.target.files[0];
        if (file) {
          this.readFile(file).then(fileData => resolve(fileData)).catch(err => reject(err));
        } else {
          reject('No file selected');
        }
      };
      input.click();
    });
  }

  private readFile(file: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const imgBlob = new Blob([reader.result as ArrayBuffer], { type: file.type });
        console.log('Read file:', file);
        resolve({ file: imgBlob, name: file.name, imageData: reader.result });
      };
      reader.onerror = error => {
        console.error('FileReader error:', error);
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  }
}
