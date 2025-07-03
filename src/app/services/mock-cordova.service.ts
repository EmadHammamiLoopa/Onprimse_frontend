import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MockCordovaService {

  constructor(private http: HttpClient) {}

  getPicture(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event: any) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (readerEvent: any) => {
          console.log('File selected:', file);
          resolve({ file, imageData: readerEvent.target.result });
        };
        reader.onerror = (error: any) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  getMultiplePictures(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (event: any) => {
        const files = Array.from(event.target.files);
        console.log('Files selected:', files);
        const promises = files.map((file: File) => {
          return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = (readerEvent: any) => {
              res({ file, imageData: readerEvent.target.result });
            };
            reader.onerror = (error: any) => {
              console.error('FileReader error:', error);
              rej(error);
            };
            reader.readAsDataURL(file);
          });
        });
        Promise.all(promises)
          .then(results => {
            console.log('All files processed:', results);
            resolve(results);
          })
          .catch(err => {
            console.error('Error processing files:', err);
            reject(err);
          });
      };
      input.click();
    });
  }

  uploadAvatar(userId: string, formData: FormData): Observable<any> {
    const url = `http://127.0.0.1:3300/api/v1/user/${userId}/avatar`;
    console.log('Uploading avatar to URL:', url);
  
    return this.http.put(url, formData).pipe(
      catchError(error => {
        console.error('Upload error:', error);
        return throwError('Upload failed'); // Handle error as needed
      })
    );
  }
}
