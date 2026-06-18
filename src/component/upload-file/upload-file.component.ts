import { Component, ViewChild } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationBannerComponent } from '../notification-banner/notification-banner.component';

@Component({
  selector: 'ga-upload-file',
  standalone: true,
  imports: [FormsModule, CommonModule, NotificationBannerComponent],
  templateUrl: './upload-file.component.html',
  styleUrls: ['./upload-file.component.scss']
})
export class UploadFileComponent {
  @ViewChild(NotificationBannerComponent) banner!: NotificationBannerComponent;

  selectedFile: File | null = null;
  selectedExamType: string = 'FREE'; 
  pdfTitle: string = '';
  isUploading: boolean = false;

  constructor(
    private communicationService: CommunicationService,
    private router: Router
  ) {}

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
    } else {
      this.banner.showError('Please select a valid PDF file.', 3000);
      this.selectedFile = null;
    }
  }

  onUpload() {
    if (!this.selectedFile || !this.pdfTitle) {
      this.banner.showError('Please fill all required fields and select a file.', 3000);
      return;
    }

    this.isUploading = true;

    const urlPayload = {
      fileName: this.selectedFile.name,
      examType: this.selectedExamType,
      contentType: this.selectedFile.type
    };

    let currentFileKey = '';

    // Execute the 3-step S3 upload chain
    this.communicationService.generatePdfPresignedUrl(urlPayload)
      .pipe(
        switchMap((urlResponse: any) => {
          const s3UploadUrl = urlResponse.uploadUrl || urlResponse.url || urlResponse.presignedUrl; 
          currentFileKey = urlResponse.fileKey;

          return this.communicationService.uploadFileToS3(s3UploadUrl, this.selectedFile!);
        }),
        switchMap(() => {
          const confirmPayload = {
            title: this.pdfTitle,
            examType: this.selectedExamType,
            fileKey: currentFileKey
          };
          return this.communicationService.confirmPdfUpload(confirmPayload);
        })
      )
      .subscribe({
        next: () => {
          this.isUploading = false;
          this.banner.show('File uploaded successfully!', 3000);
          setTimeout(() => this.router.navigate(['/file']), 1500);
        },
        error: (error) => {
          this.isUploading = false;
          console.error('Upload sequence failed', error);
          this.banner.showError('Upload failed. Please try again.', 4000);
        }
      });
  }

  cancelUpload() {
    this.router.navigate(['/file']);
  }

  onBannerClosed(): void {
    // Banner dismissed - no additional action needed
  }
}