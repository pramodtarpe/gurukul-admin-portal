import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';

@Component({
  selector: 'ga-maintenance-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-status.component.html',
  styleUrls: ['./maintenance-status.component.scss']
})
export class MaintenanceStatusComponent implements OnInit {
  isMaintenanceModeEnabled: boolean = false;
  loading: boolean = false;
  toggling: boolean = false;
  toggleSuccess: boolean = false;
  toggleError: string = '';

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

    this.toggleSuccess = false;
    this.toggleError = '';
    this.toggling = true;

    this.communicationService.toggleMaintenance(!this.isMaintenanceModeEnabled).subscribe({
      next: () => {
        this.isMaintenanceModeEnabled = !this.isMaintenanceModeEnabled;
        this.toggleSuccess = true;
        this.toggling = false;

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
}