import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { CommunicationService } from '../../service/communication/communication.service';

@Component({
  selector: 'ga-maintenance-status',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: './maintenance-status.component.html',
  styleUrl: './maintenance-status.component.scss'
})
export class MaintenanceStatusComponent implements OnInit {
  isMaintenanceModeEnabled: boolean = false;
  loading: boolean = false;
  toggling: boolean = false;
  toggleSuccess: boolean = false;
  toggleError: string = '';

  showConfirmDialog: boolean = false;
  confirmAction: 'enable' | 'disable' = 'enable';

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.fetchStatus();
  }

  fetchStatus(): void {
    this.loading = true;
    this.toggleSuccess = false;
    this.toggleError = '';

    this.communicationService.getMaintenanceStatus().subscribe({
      next: (response) => {
        this.isMaintenanceModeEnabled = response?.maintenanceMode ?? false;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to fetch maintenance status:', error);
        this.loading = false;
        this.toggleError = 'Unable to load current status.';
      }
    });
  }

  onToggle(): void {
    if (this.toggling || this.loading) return;

    // Open confirmation dialog instead of directly toggling
    this.confirmAction = !this.isMaintenanceModeEnabled ? 'enable' : 'disable';
    this.showConfirmDialog = true;
  }

  onConfirmToggle(): void {
    this.showConfirmDialog = false;
    this.toggleSuccess = false;
    this.toggleError = '';
    this.toggling = true;

    const shouldEnable = this.confirmAction === 'enable';
    this.communicationService.toggleMaintenance(shouldEnable).subscribe({
      next: () => {
        this.isMaintenanceModeEnabled = shouldEnable;
        this.toggleSuccess = true;
        this.toggling = false;

        // Notify other components (e.g., maintenance banner) that mode changed
        window.dispatchEvent(new CustomEvent('maintenance-mode-changed'));

        // Reset feedback after 3 seconds
        setTimeout(() => {
          this.toggleSuccess = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Failed to toggle maintenance mode:', error);
        this.toggleError = 'Unable to update maintenance status. Please try again.';
        this.toggling = false;

        // Reset error after 5 seconds
        setTimeout(() => {
          this.toggleError = '';
        }, 5000);
      }
    });
  }

  onCancelToggle(): void {
    this.showConfirmDialog = false;
  }
}