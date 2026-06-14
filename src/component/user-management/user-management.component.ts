import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';

@Component({
  selector: 'ga-user-management',
  standalone: true,
  imports: [CommonModule],
  providers: [CommunicationService],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  userData: any[] = [];
  isLoading: boolean = false;

  // --- Pagination State Architecture ---
  currentCursor: string | null = null;
  nextCursor: string | null = null;
  cursorHistory: string[] = []; // Stack to remember previous pages

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.resetPaginationAndLoad();
  }

  // Resets pagination tokens before initial load
  resetPaginationAndLoad(): void {
    this.cursorHistory = [];
    this.currentCursor = null;
    this.nextCursor = null;
    this.loadUsers();
  }

  loadUsers(cursor?: string | null): void {
    this.isLoading = true;
    this.communicationService.getAllUsers(cursor || undefined).subscribe({
      next: (response) => {
        this.userData = response?.items || [];
        
        // Capture the token for the next page
        this.nextCursor = response?.lastEvaluatedKey || null;
        this.currentCursor = cursor || null;
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching user data:', error);
        this.isLoading = false;
      }
    });
  }

  // --- Pagination Triggers ---
  loadNextPage(): void {
    if (this.nextCursor) {
      // Save the current page cursor to history before moving forward
      this.cursorHistory.push(this.currentCursor || '');
      this.loadUsers(this.nextCursor);
    }
  }

  loadPreviousPage(): void {
    if (this.cursorHistory.length > 0) {
      // Pop the last visited cursor from the history stack
      const prevCursor = this.cursorHistory.pop();
      this.loadUsers(prevCursor === '' ? null : prevCursor);
    }
  }

  hasUsers(): boolean {
    return this.userData && this.userData.length > 0;
  }
}