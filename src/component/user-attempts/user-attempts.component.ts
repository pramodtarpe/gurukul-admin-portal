import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { NotificationService } from '../../service/notification.service';

@Component({
  selector: 'ga-user-attempts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-attempts.component.html',
  styleUrl: './user-attempts.component.scss'
})
export class UserAttemptsComponent implements OnInit {
  @Input() examId!: string;
  @Input() examTitle!: string;
  @Output() close = new EventEmitter<void>();

  attempts: any[] = [];
  isLoading: boolean = false;

  currentCursor: string | null = null;
  nextCursor: string | null = null;
  cursorHistory: string[] = [];

  constructor(
    private communicationService: CommunicationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.examId) {
      this.loadAttempts(null);
    }
  }

  loadAttempts(cursor: string | null) {
    this.isLoading = true;
    this.communicationService.getExamAttempts(this.examId, cursor || undefined).subscribe({
      next: (response) => {
        this.attempts = response?.items || [];
        this.nextCursor = response?.lastEvaluatedKey || null;
        this.currentCursor = cursor;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching attempts:', error);
        this.notificationService.showError('Failed to load user attempts.');
        this.isLoading = false;
      }
    });
  }

  loadNextPage() {
    if (this.nextCursor) {
      this.cursorHistory.push(this.currentCursor || '');
      this.loadAttempts(this.nextCursor);
    }
  }

  loadPreviousPage() {
    if (this.cursorHistory.length > 0) {
      const prevCursor = this.cursorHistory.pop() ?? ''; 
      this.loadAttempts(prevCursor === '' ? null : prevCursor);
    }
  }

  closeModal() {
    this.close.emit();
  }
}