import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommunicationService } from '../../service/communication/communication.service';
import { ExamBuilderComponent } from '../exam-builder/exam-builder.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ga-edit-exam',
  standalone: true,
  imports: [CommonModule, ExamBuilderComponent],
  template: `
    <ga-exam-builder 
      *ngIf="examData"
      mode="edit"
      [initialData]="examData"
      [isSubmitting]="isSubmitting"
      (save)="handleSave($event)"
      (cancel)="handleCancel()">
    </ga-exam-builder>
    
    <div *ngIf="!examData" style="text-align: center; padding: 3rem;">
      <h3>Loading Exam Data...</h3>
    </div>
  `
})
export class EditExamComponent implements OnInit {
  examId: string | null = null;
  examData: any = null;
  isSubmitting = false;

  constructor(
    private communicationService: CommunicationService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    // When page loads, fetch the exam ID from the URL
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
        alert('Exam changes saved successfully!');
        this.router.navigate(['/exam'], { queryParams: { type: formPayload.examType } });
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting = false;
        alert('Failed to update the exam.');
      }
    });
  }
}