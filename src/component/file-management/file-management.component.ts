import { Component, OnInit } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'ga-file-management',
  standalone: true,
  imports: [ FormsModule, CommonModule, RouterLink, ConfirmDialogComponent ],
  providers: [ CommunicationService ],
  templateUrl: './file-management.component.html',
  styleUrl: './file-management.component.scss'
})
export class FileManagementComponent implements OnInit {
  examTypes: string[] = ['FREE', 'FOREST_BHARTI', 'POLICE_BHARTI'];
  selectedExamType: string = 'FREE'; 

  examTypeTranslations: { [key: string]: string } = {
    'FREE': 'मोफत चाचणी',
    'FOREST_BHARTI': 'वनरक्षक भरती',
    'POLICE_BHARTI': 'पोलीस भरती'
  };

  pdfData: any[] = [];
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
    this.loadPdfs(this.selectedExamType);
  }

  loadPdfs(type: string, cursor?: string | null) {
    this.isLoading = true;
    this.communicationService.getAllPdfs(type, cursor || undefined).subscribe({
      next: (response) => {
        this.pdfData = response?.items || response || [];
        
        // Capture the token for the next page
        this.nextCursor = response?.lastEvaluatedKey || null;
        this.currentCursor = cursor || null;
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching PDF data:', error);
        this.isLoading = false;
      }
    });
  }

  // --- Pagination Triggers ---
  loadNextPage() {
    if (this.nextCursor) {
      // Save the current page cursor to history before moving forward
      this.cursorHistory.push(this.currentCursor || '');
      this.loadPdfs(this.selectedExamType, this.nextCursor);
    }
  }

  loadPreviousPage() {
    if (this.cursorHistory.length > 0) {
      // Pop the last visited cursor from the history stack
      const prevCursor = this.cursorHistory.pop();
      this.loadPdfs(this.selectedExamType, prevCursor === '' ? null : prevCursor);
    }
  }

  hasPdfs(): boolean {
    return this.pdfData && this.pdfData.length > 0;
  }

  // --- Delete Confirmation Dialog State ---
  showConfirmDialog = false;
  pdfToDelete: any = null;

  deletePdf(pdfId: string): void {
    if (!pdfId) {
      alert('Error: Missing PDF ID.');
      return;
    }

    const pdf = this.pdfData.find(p => p.pdfId === pdfId);
    this.pdfToDelete = pdf || { title: 'Unknown File', pdfId };
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (!this.pdfToDelete) return;

    const id = this.pdfToDelete.pdfId;
    this.showConfirmDialog = false;
    
    this.isLoading = true; 

    this.communicationService.deletePdf(id).subscribe({
      next: () => {
        alert('PDF deleted successfully!');
        // Refresh the current page view cleanly
        this.loadPdfs(this.selectedExamType, this.currentCursor); 
      },
      error: (error) => {
        console.error('Error deleting PDF:', error);
        alert('Failed to delete the PDF. Check the console for details.');
        this.isLoading = false;
      }
    });

    this.pdfToDelete = null;
  }

  onCancelDelete(): void {
    this.showConfirmDialog = false;
    this.pdfToDelete = null;
  }
}
