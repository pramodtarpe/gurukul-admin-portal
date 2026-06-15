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

  // --- Privacy State ---
  visiblePhones: Set<string> = new Set<string>(); // Tracks which rows have unblurred phones

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
    this.visiblePhones.clear(); // Re-hide all phone numbers when changing pages

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

  // --- Phone Visibility Triggers ---
  togglePhoneVisibility(email: string): void {
    if (this.visiblePhones.has(email)) {
      this.visiblePhones.delete(email);
    } else {
      this.visiblePhones.add(email);
    }
  }

  isPhoneVisible(email: string): boolean {
    return this.visiblePhones.has(email);
  }

  // --- Pagination Triggers ---
  loadNextPage(): void {
    if (this.nextCursor) {
      this.cursorHistory.push(this.currentCursor || '');
      this.loadUsers(this.nextCursor);
    }
  }

  loadPreviousPage(): void {
    if (this.cursorHistory.length > 0) {
      const prevCursor = this.cursorHistory.pop();
      this.loadUsers(prevCursor === '' ? null : prevCursor);
    }
  }

  hasUsers(): boolean {
    return this.userData && this.userData.length > 0;
  }
}