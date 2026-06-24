import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
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
export class UserAttemptsComponent implements OnInit, OnDestroy {
  @Input() examId!: string;
  @Input() examTitle!: string;
  @Output() close = new EventEmitter<void>();

  attempts: any[] = [];
  isLoading: boolean = false;

  currentCursor: string | null = null;
  nextCursor: string | null = null;
  cursorHistory: string[] = [];

  // --- Tooltip State ---
  profileCache: Record<string, any> = {};
  hoveredEmail: string | null = null;
  isProfileLoading: boolean = false;
  tooltipStyle: any = { display: 'none' };
  hoverTimeout: any;
  mouseX = 0;
  mouseY = 0;

  constructor(
    private communicationService: CommunicationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.examId) {
      this.loadAttempts(null);
    }
  }

  ngOnDestroy(): void {
    this.clearHoverTimeout();
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

  // --- Tooltip Hover Logic ---
  onMouseEnterEmail(email: string, event: MouseEvent) {
    this.clearHoverTimeout();
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;

    // Debounce for 400ms to prevent spamming APIs on quick swipe-overs
    this.hoverTimeout = setTimeout(() => {
      this.hoveredEmail = email;
      this.updateTooltipPosition();

      // Fetch if not in cache
      if (!this.profileCache[email]) {
        this.isProfileLoading = true;
        this.communicationService.getUserProfileByEmail(email).subscribe({
          next: (res) => {
            this.profileCache[email] = res;
            this.isProfileLoading = false;
          },
          error: () => {
            this.profileCache[email] = { error: true };
            this.isProfileLoading = false;
          }
        });
      }
    }, 400);
  }

  onMouseMove(event: MouseEvent) {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
    if (this.hoveredEmail) {
      this.updateTooltipPosition();
    }
  }

  onMouseLeaveEmail() {
    this.clearHoverTimeout();
    this.hoveredEmail = null;
    this.tooltipStyle = { display: 'none' };
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  private updateTooltipPosition() {
    const offsetX = 15; // Offset slightly right of the cursor
    const offsetY = 15; // Offset slightly below the cursor
    
    this.tooltipStyle = {
      display: 'block',
      left: `${this.mouseX + offsetX}px`,
      top: `${this.mouseY + offsetY}px`,
    };
  }
}