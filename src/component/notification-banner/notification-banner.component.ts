import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type NotificationType = 'success' | 'error';

@Component({
  selector: 'ga-notification-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-banner.component.html',
  styleUrls: ['./notification-banner.component.scss']
})
export class NotificationBannerComponent implements OnDestroy {
  @Input() message: string = '';
  @Input() type: NotificationType = 'success';
  @Output() closed = new EventEmitter<void>();

  visible = false;
  private hideTimeout: any;
  private showTimeout: any;

  get icon(): string {
    return this.type === 'success' ? 'ph ph-check-circle' : 'ph ph-warning-circle';
  }

  show(message?: string, durationMs: number = 3000): void {
    if (message) this.message = message;
    this.type = 'success';
    clearTimeout(this.hideTimeout);
    cancelAnimationFrame(this.showTimeout);

    // Force reflow so the animation restarts cleanly
    this.visible = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.visible = true;
      });
    });

    if (durationMs > 0) {
      this.hideTimeout = setTimeout(() => this.close(), durationMs);
    }
  }

  showError(message?: string, durationMs: number = 4000): void {
    if (message) this.message = message;
    this.type = 'error';
    clearTimeout(this.hideTimeout);
    cancelAnimationFrame(this.showTimeout);

    // Force reflow so the animation restarts cleanly
    this.visible = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.visible = true;
      });
    });

    if (durationMs > 0) {
      this.hideTimeout = setTimeout(() => this.close(), durationMs);
    }
  }

  close(): void {
    clearTimeout(this.hideTimeout);
    cancelAnimationFrame(this.showTimeout);
    this.visible = false;
    // Emit after the CSS transition finishes (~300ms)
    setTimeout(() => this.closed.emit(), 300);
  }

  ngOnDestroy(): void {
    clearTimeout(this.hideTimeout);
    cancelAnimationFrame(this.showTimeout);
  }
}