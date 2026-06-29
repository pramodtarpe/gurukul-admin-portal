import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { NotificationService } from '../../service/notification.service';
import { environment } from '../../environments/environment';

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

  // --- Detail Modal State ---
  selectedAttemptEmail: string | null = null;
  detailModalLoading: boolean = false;
  attemptDetail: any = null;
  activeSectionIndex: number = 0;

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

    this.hoverTimeout = setTimeout(() => {
      this.hoveredEmail = email;
      this.updateTooltipPosition();

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

  onImageError(email: string | null) {
    if (email && this.profileCache[email]) {
      this.profileCache[email].profilePictureUrl = null;
    }
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
    const offsetX = 15;
    const offsetY = 15;
    
    this.tooltipStyle = {
      display: 'block',
      left: `${this.mouseX + offsetX}px`,
      top: `${this.mouseY + offsetY}px`,
    };
  }

  // --- View Attempt Detail Modal ---
  viewAttemptDetail(email: string) {
    this.selectedAttemptEmail = email;
    this.detailModalLoading = true;
    this.attemptDetail = null;
    this.activeSectionIndex = 0;

    this.communicationService.getExamAttemptByEmail(this.examId, email).subscribe({
      next: (response) => {
        // Pre-process sections for display (add collapsed state)
        if (response?.sections) {
          response.sections.forEach((section: any) => {
            section._collapsed = false;
            section.questions?.forEach((q: any, _caIdx: number) => {
              this.setQuestionVerdict(q);
            });
          });
        }
        this.attemptDetail = response;
        this.detailModalLoading = false;
      },
      error: (error) => {
        console.error('Error fetching attempt detail:', error);
        this.notificationService.showError('Failed to load attempt details.');
        this.detailModalLoading = false;
        this.selectedAttemptEmail = null;
      }
    });
  }

  closeDetailModal() {
    this.selectedAttemptEmail = null;
    this.attemptDetail = null;
    this.detailModalLoading = false;
  }

  selectSection(index: number) {
    this.activeSectionIndex = index;
  }

  getScoreColor(score: number, totalQuestions: number): string {
    const pct = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    if (pct >= 70) return '#059669';
    if (pct >= 40) return '#d97706';
    return '#dc2626';
  }

  formatTimestamp(timestamp: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  }

  getDiagramUrl(diagramUrl: string | null): string {
    if (!diagramUrl) return '';
    return diagramUrl.startsWith('http') ? diagramUrl : `${environment.apiBase}${diagramUrl}`;
  }

  onDiagramImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  // --- Question verdict helpers ---
  /**
   * Determines the verdict class for a question based on correctAnswersIndex and selectedAnswerIndex.
   * 
   * Verdict logic:
   * - CORRECT (verdict-correct):      both are non-null AND match
   * - INCORRECT (verdict-incorrect):  both are non-null AND do NOT match
   * - UNATTEMPTED (verdict-unattempted): selectedAnswerIndex is null/empty but correctAnswersIndex exists
   * - UNMAPPED (verdict-unmapped):     correctAnswersIndex is null (exam data not yet mapped)
   */
  getVerdictClass(question: any): string {
    if (question._verdict === 'correct') return 'verdict-correct';
    if (question._verdict === 'incorrect') return 'verdict-incorrect';
    if (question._verdict === 'unattempted') return 'verdict-unattempted';
    if (question._verdict === 'unmapped') return 'verdict-unmapped';
    // Fallback: treat as unattempted
    return 'verdict-unattempted';
  }

  getVerdictText(question: any): string {
    return question._verdict ? this.getVerdictLabel(question._verdict) : 'Unattempted';
  }

  private getVerdictLabel(verdict: string): string {
    switch (verdict) {
      case 'correct': return 'Correct';
      case 'incorrect': return 'Incorrect';
      case 'unattempted': return 'Unattempted';
      case 'unmapped': return 'Unmapped';
      default: return 'Unknown';
    }
  }

  /**
   * Returns the Phosphor icon name for each verdict state.
   */
  getVerdictIcon(question: any): string {
    switch (question._verdict) {
      case 'correct':     return 'check-circle';
      case 'incorrect':   return 'x-circle';
      case 'unattempted': return 'minus-circle';
      case 'unmapped':    return 'info';
      default:            return 'help-circle';
    }
  }

  /**
   * Sets verdict and visual flags on a question object.
   */
  private setQuestionVerdict(question: any): void {
    const correctAnswersIndex = question.correctAnswersIndex;
    const selectedAnswerIndex = question.selectedAnswerIndex;

    // Case d -> unmapped: no correct answer is mapped for this question yet
    if (correctAnswersIndex === null || correctAnswersIndex === undefined) {
      question._verdict = 'unmapped';
      question._isCorrect = false;
      question._isIncorrect = false;
      question._isUnattempted = false;
      return;
    }

    // Case c -> unattempted: user did not select anything (null, undefined, or empty array)
    if (selectedAnswerIndex === null || selectedAnswerIndex === undefined) {
      question._verdict = 'unattempted';
      question._isCorrect = false;
      question._isIncorrect = false;
      question._isUnattempted = true;
      return;
    }

    if (Array.isArray(selectedAnswerIndex) && selectedAnswerIndex.length === 0) {
      question._verdict = 'unattempted';
      question._isCorrect = false;
      question._isIncorrect = false;
      question._isUnattempted = true;
      return;
    }

    // Both are non-null from here — determine correct vs incorrect
    const isMatch = this.compareAnswers(correctAnswersIndex, selectedAnswerIndex);

    if (isMatch) {
      question._verdict = 'correct';
      question._isCorrect = true;
      question._isIncorrect = false;
      question._isUnattempted = false;
    } else {
      question._verdict = 'incorrect';
      question._isCorrect = false;
      question._isIncorrect = true;
      question._isUnattempted = false;
    }
  }

  /**
   * Compares two answer values for equality, handling both scalar and array formats.
   */
  private compareAnswers(correct: any, selected: any): boolean {
    const correctArr = Array.isArray(correct) ? [...correct].sort() : [correct];
    const selectedArr = Array.isArray(selected) ? [...selected].sort() : [selected];

    if (correctArr.length !== selectedArr.length) return false;

    for (let i = 0; i < correctArr.length; i++) {
      if (correctArr[i] !== selectedArr[i]) return false;
    }
    return true;
  }

  // --- Option display helper ---
  isOptionSelectedByUser(question: any, optionIndex: number): boolean {
    const selected = question.selectedAnswerIndex;
    if (selected === null || selected === undefined) return false;
    if (Array.isArray(selected)) return selected.includes(optionIndex);
    return selected === optionIndex;
  }

  isOptionCorrect(question: any, optionIndex: number): boolean {
    const correct = question.correctAnswersIndex;
    if (correct === null || correct === undefined) return false;
    if (Array.isArray(correct)) return correct.includes(optionIndex);
    return correct === optionIndex;
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}