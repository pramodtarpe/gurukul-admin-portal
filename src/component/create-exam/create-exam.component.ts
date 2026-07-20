import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommunicationService } from '../../service/communication/communication.service';
import { ExamBuilderComponent } from '../exam-builder/exam-builder.component';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../service/notification.service';

@Component({
  selector: 'ga-create-exam',
  standalone: true,
  imports: [CommonModule, ExamBuilderComponent],
  template: `
    <ga-exam-builder 
      mode="create"
      #examBuilder
      [isSubmitting]="isSubmitting"
      (save)="handleSave($event)"
      (cancel)="handleCancel()">
    </ga-exam-builder>
  `,
})
export class CreateExamComponent implements AfterViewInit {
  @ViewChild('examBuilder') examBuilder!: ExamBuilderComponent;

  isSubmitting = false;

  ngAfterViewInit() { /* ViewChild ready */ }

  constructor(
    private communicationService: CommunicationService,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  handleCancel() {
    this.router.navigate(['/exam']);
  }

  handleSave(formPayload: any) {
    this.isSubmitting = true;

    const finalPayload = {
      ...formPayload,
      examCreatedDate: Math.floor(Date.now() / 1000),
    };

    this.communicationService.createExam(finalPayload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.examBuilder?.onPublishSuccess();
        this.notificationService.showSuccess('🎉 New exam created and published successfully!');
        setTimeout(() => {
          this.router.navigate(['/exam'], { queryParams: { type: formPayload.examType } });
        }, 250);
      },
      error: (err) => {
        console.error(err);
        // Draft is preserved on failure — user can retry or navigate away
        this.notificationService.showError('Failed to publish the exam. Your progress has been saved as a draft and will be restored when you return.');
      },
    });
  }
}