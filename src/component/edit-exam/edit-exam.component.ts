import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommunicationService } from '../../service/communication/communication.service';
import { ExamBuilderComponent } from '../exam-builder/exam-builder.component';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../service/notification.service';

@Component({
  selector: 'ga-edit-exam',
  standalone: true,
  imports: [CommonModule, ExamBuilderComponent],
  template: `
    <ga-exam-builder 
      *ngIf="examData"
      #examBuilder
      mode="edit"
      [initialData]="examData"
      [draftScopeId]="examId"
      [isSubmitting]="isSubmitting"
      (save)="handleSave($event)"
      (cancel)="handleCancel()">
    </ga-exam-builder>
    
    <div *ngIf="!examData" style="text-align: center; padding: 3rem;">
      <h3>Loading Exam Data...</h3>
    </div>
  `
})
export class EditExamComponent implements OnInit, AfterViewInit {
  @ViewChild('examBuilder') examBuilder!: ExamBuilderComponent;

  examId: string | null = null;
  examData: any = null;
  isSubmitting = false;

  ngAfterViewInit() { /* ViewChild ready */ }

  constructor(
    private communicationService: CommunicationService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.examId = params.get('id');
      if (this.examId) {
        this.communicationService.getExamById(this.examId).subscribe(data => {
          this.examData = data;
        });
      }
    });
  }

  handleCancel() {
    const type = this.examData?.examType || 'FREE';
    this.router.navigate(['/exam'], { queryParams: { type } });
  }

  handleSave(formPayload: any) {
    if (!this.examId) return;
    this.isSubmitting = true;

    const finalPayload = {
      ...this.examData, 
      ...formPayload
    };

    this.communicationService.updateExam(this.examId, finalPayload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.examBuilder?.onPublishSuccess();
        this.notificationService.showSuccess('Exam changes saved successfully!');
        setTimeout(() => {
          this.router.navigate(['/exam'], { queryParams: { type: formPayload.examType } });
        }, 250);
      },
      error: (err) => {
        console.error(err);
        // Draft preserved on failure — user can retry
        this.notificationService.showError('Failed to update the exam. Your progress has been saved as a draft and will be restored.');
        this.isSubmitting = false;
      }
    });
  }
}