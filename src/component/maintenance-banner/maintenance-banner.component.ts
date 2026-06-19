import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'ga-maintenance-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-banner.component.html',
  styleUrl: './maintenance-banner.component.scss'
})
export class MaintenanceBannerComponent implements OnInit, OnDestroy {
  isMaintenanceModeEnabled = false;
  private destroy$ = new Subject<void>();

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.fetchStatus();
    // Listen for toggle events from the maintenance-status component
    window.addEventListener('maintenance-mode-changed', () => this.fetchStatus());
  }

  fetchStatus(): void {
    this.communicationService.getMaintenanceStatus().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.isMaintenanceModeEnabled = response?.maintenanceMode ?? false;
      },
      error: () => {
        this.isMaintenanceModeEnabled = false;
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('maintenance-mode-changed', () => this.fetchStatus());
    this.destroy$.next();
    this.destroy$.complete();
  }
}