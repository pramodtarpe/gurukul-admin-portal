import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommunicationService } from '../../service/communication/communication.service';
import { ExamBuilderComponent } from '../exam-builder/exam-builder.component'; // Imports your new UI
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ga-create-exam',
  standalone: true,
  imports: [CommonModule, ExamBuilderComponent],
  // It literally just points to your exam builder and says "use create mode"
  template: `
    <ga-exam-builder 
      mode="create"
      [isSubmitting]="isSubmitting"
      (save)="handleSave($event)"
      (cancel)="handleCancel()">
    </ga-exam-builder>
  `
})
export class CreateExamComponent {
  isSubmitting = false;

  constructor(private communicationService: CommunicationService, private router: Router) { }

  handleCancel() {
    this.router.navigate(['/exam']);
  }

  handleSave(formPayload: any) {
    this.isSubmitting = true;
    const finalPayload = {
      ...formPayload,
      examCreatedDate: Math.floor(Date.now() / 1000)
    };

    this.communicationService.createExam(finalPayload).subscribe({
      next: () => {
        this.isSubmitting = false;
        alert('🎉 New exam created and published successfully!');
        this.router.navigate(['/exam'], { queryParams: { type: formPayload.examType } });
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting = false;
        alert('Failed to save the exam.');
      }
    });
  }
}