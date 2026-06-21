import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error';

export interface NotificationConfig {
  message: string;
  type: NotificationType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<NotificationConfig | null>(null);

  showSuccess(message: string, durationMs: number = 3000): void {
    this.notifications.next({ message, type: 'success', duration: durationMs });
  }

  showError(message: string, durationMs: number = 4000): void {
    this.notifications.next({ message, type: 'error', duration: durationMs });
  }

  clear(): void {
    this.notifications.next(null);
  }

  getNotification(): Observable<NotificationConfig | null> {
    return this.notifications.asObservable();
  }
}