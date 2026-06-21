import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NotificationType = 'success' | 'error';

@Component({
  selector: 'ga-notification-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-banner.component.html',
  styleUrl: './notification-banner.component.scss'
})
export class NotificationBannerComponent implements OnDestroy {
  @Input() message: string = '';
  @Input() type: NotificationType = 'success';
  @Output() closed = new EventEmitter<void>();

  visible = false;
  private hideTimeout: any;
  private showAnimationFrameId: number | null = null;
  private isDestroyed = false;

  get icon(): string {
    return this.type === 'success' ? 'ph ph-check-circle' : 'ph ph-warning-circle';
  }

  trigger(message: string, type: NotificationType, durationMs?: number): void {
    if (this.isDestroyed) return;
    
    this.message = message;
    this.type = type;
    clearTimeout(this.hideTimeout);
    if (this.showAnimationFrameId !== null) {
      cancelAnimationFrame(this.showAnimationFrameId);
    }

    // Force reflow so the animation restarts cleanly
    this.visible = false;
    requestAnimationFrame(() => {
      this.visible = true;
    });

    if (durationMs && durationMs > 0) {
      this.hideTimeout = setTimeout(() => this.close(), durationMs);
    }
  }

  show(message: string, durationMs?: number): void {
    this.trigger(message, 'success', durationMs);
  }

  showError(message: string, durationMs?: number): void {
    this.trigger(message, 'error', durationMs);
  }

  close(): void {
    clearTimeout(this.hideTimeout);
    if (this.showAnimationFrameId !== null) {
      cancelAnimationFrame(this.showAnimationFrameId);
    }
    this.visible = false;
    // Emit after the CSS transition finishes (~300ms)
    setTimeout(() => this.closed.emit(), 350);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    clearTimeout(this.hideTimeout);
    if (this.showAnimationFrameId !== null) {
      cancelAnimationFrame(this.showAnimationFrameId);
    }
  }
}