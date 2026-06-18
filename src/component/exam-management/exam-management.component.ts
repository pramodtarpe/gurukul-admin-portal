import { Component, OnInit } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'ga-exam-management',
  standalone: true,
  imports: [ FormsModule, CommonModule, RouterLink, ConfirmDialogComponent ],
  providers: [ CommunicationService ],
  templateUrl: './exam-management.component.html',
  styleUrl: './exam-management.component.scss'
})
export class ExamManagementComponent implements OnInit {
  examTypes: string[] = ['FREE', 'FOREST_BHARTI', 'POLICE_BHARTI'];
  selectedExamType: string = 'FREE'; 

  examTypeTranslations: { [key: string]: string } = {
    'FREE': 'मोफत चाचणी',
    'FOREST_BHARTI': 'वनरक्षक भरती',
    'POLICE_BHARTI': 'पोलीस भरती'
  };

  examData: any[] = [];
  isLoading: boolean = false;

  // --- Pagination State Architecture ---
  currentCursor: string | null = null;
  nextCursor: string | null = null;
  cursorHistory: string[] = []; // Stack to remember previous pages

  constructor(
    private communicationService: CommunicationService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const typeParam = params['type'];
      
      if (typeParam && this.examTypes.includes(typeParam)) {
        this.selectedExamType = typeParam; 
      } else {
        this.selectedExamType = 'FREE';    
      }

      this.resetPaginationAndLoad();
    });
  }

  // Triggered when dropdown changes
  onExamTypeChange() {
    this.resetPaginationAndLoad();
  }

  // Resets all tokens before loading a fresh category
  resetPaginationAndLoad() {
    this.cursorHistory = [];
    this.currentCursor = null;
    this.nextCursor = null;
    this.loadExams(this.selectedExamType);
  }

  loadExams(type: string, cursor?: string | null) {
    this.isLoading = true;
    this.communicationService.getAllExams(type, cursor || undefined).subscribe({
      next: (response) => {
        this.examData = response?.items || response || [];
        
        // Capture the token for the next page
        this.nextCursor = response?.lastEvaluatedKey || null;
        this.currentCursor = cursor || null;
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching exam data:', error);
        this.isLoading = false;
      }
    });
  }

  // --- Pagination Triggers ---
  loadNextPage() {
    if (this.nextCursor) {
      // Save the current page cursor to history before moving forward
      this.cursorHistory.push(this.currentCursor || '');
      this.loadExams(this.selectedExamType, this.nextCursor);
    }
  }

  loadPreviousPage() {
    if (this.cursorHistory.length > 0) {
      // Pop the last visited cursor from the history stack
      const prevCursor = this.cursorHistory.pop();
      this.loadExams(this.selectedExamType, prevCursor === '' ? null : prevCursor);
    }
  }

  hasExamsOfType(type: string): boolean {
    if (!this.examData) return false;
    return this.examData.some(exam => exam.examType === type);
  }

  // --- Delete Confirmation Dialog State ---
  showConfirmDialog = false;
  examToDelete: any = null;

  deleteExam(exam: any): void {
    this.examToDelete = exam;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (!this.examToDelete) return;

    const title = this.examToDelete.title;
    const id = this.examToDelete.examId;
    this.showConfirmDialog = false;
    
    this.isLoading = true; 

    this.communicationService.deleteExam(id).subscribe({
      next: () => {
        alert(`Successfully deleted the exam: ${title}`);
        this.loadExams(this.selectedExamType, this.currentCursor); 
      },
      error: (error) => {
        console.error('Error deleting exam:', error);
        alert(`Failed to delete the exam: ${title}. Please try again later.`);
        this.isLoading = false;
      }
    });

    this.examToDelete = null;
  }

  onCancelDelete(): void {
    this.showConfirmDialog = false;
    this.examToDelete = null;
  }
}
