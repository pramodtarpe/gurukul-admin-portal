import { Component, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationBannerComponent, NotificationType } from '../notification-banner/notification-banner.component';
import { NotificationService, NotificationConfig } from '../../service/notification.service';

@Component({
  selector: 'ga-notification-wrapper',
  standalone: true,
  imports: [CommonModule, NotificationBannerComponent],
  template: `
    <ng-container *ngIf="notification$ | async as notification">
      <ga-notification-banner 
        #banner
        [message]="notification?.message || ''"
        [type]="getType(notification)">
      </ga-notification-banner>
    </ng-container>
  `,
})
export class NotificationWrapperComponent implements AfterViewInit, OnDestroy {
  notification$ = this.notificationService.getNotification();

  @ViewChild('banner') banner!: NotificationBannerComponent;

  private unsub: any;

  constructor(private notificationService: NotificationService) {}

  getType(n: NotificationConfig | null): NotificationType {
    return (n?.type || 'success') as NotificationType;
  }

  ngAfterViewInit(): void {
    this.unsub = this.notification$.subscribe((config: NotificationConfig | null) => {
      if (config && config.message && this.banner) {
        if (config.type === 'success') {
          this.banner.show(config.message, config.duration);
        } else {
          this.banner.showError(config.message, config.duration);
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.unsub) {
      this.unsub.unsubscribe();
    }
  }
}