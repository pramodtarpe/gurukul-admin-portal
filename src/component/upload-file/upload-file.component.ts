import { Component } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ga-upload-file',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './upload-file.component.html',
  styleUrls: ['./upload-file.component.scss']
})
export class UploadFileComponent {
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
      alert('Please select a valid PDF file.');
      this.selectedFile = null;
    }
  }

  onUpload() {
    if (!this.selectedFile || !this.pdfTitle) {
      alert('Please fill all required fields and select a file.');
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
          // Verify these keys match your API response exactly!
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
          alert('File uploaded successfully!');
          this.router.navigate(['/file']); 
        },
        error: (error) => {
          this.isUploading = false;
          console.error('Upload sequence failed', error);
          alert('Upload failed. Check the console for details.');
        }
      });
  }

  cancelUpload() {
    this.router.navigate(['/file']);
  }
}