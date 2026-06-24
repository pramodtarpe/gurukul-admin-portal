import { Component, OnInit, HostListener } from '@angular/core';
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
  cursorHistory: string[] = []; 

  // --- Privacy State ---
  visiblePhones: Set<string> = new Set<string>();

  // --- Resizing State ---
  isResizing = false;
  currentResizeElement: HTMLElement | null = null;
  startX = 0;
  startWidth = 0;

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.resetPaginationAndLoad();
  }

  resetPaginationAndLoad(): void {
    this.cursorHistory = [];
    this.currentCursor = null;
    this.nextCursor = null;
    this.loadUsers();
  }

  loadUsers(cursor?: string | null): void {
    this.isLoading = true;
    this.visiblePhones.clear(); 

    this.communicationService.getAllUsers(cursor || undefined).subscribe({
      next: (response) => {
        this.userData = response?.items || [];
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

  // --- Column Resizer Logic ---
  onResizeStart(event: MouseEvent, element: HTMLElement): void {
    event.preventDefault(); // Prevents text selection while dragging
    this.isResizing = true;
    this.currentResizeElement = element;
    this.startX = event.pageX;
    this.startWidth = element.offsetWidth;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isResizing && this.currentResizeElement) {
      // Calculate new width based on drag distance
      const newWidth = this.startWidth + (event.pageX - this.startX);
      // Enforce a minimum width of 100px so it doesn't collapse entirely
      if (newWidth > 100) {
        this.currentResizeElement.style.width = `${newWidth}px`;
        this.currentResizeElement.style.minWidth = `${newWidth}px`;
        this.currentResizeElement.style.maxWidth = `${newWidth}px`;
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.isResizing) {
      this.isResizing = false;
      this.currentResizeElement = null;
    }
  }

  // --- Profile Picture Fallback & Initials ---
  onImageError(user: any): void {
    // Reverts to the initials placeholder if the image fails to load
    user.profilePictureUrl = null;
  }

  getInitials(name: string, email: string): string {
    const targetStr = (name && name.trim().toLowerCase() !== 'unknown') ? name.trim() : email;
    if (!targetStr) return '?';

    // If it's a multi-word name (e.g., "First Last"), extract both initials
    const parts = targetStr.split(' ');
    if (parts.length >= 2 && targetStr === name.trim()) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    // Otherwise, just return the first letter
    return targetStr.charAt(0).toUpperCase();
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
      // Safely pop handling TS strict null checks
      const prevCursor = this.cursorHistory.pop() ?? '';
      this.loadUsers(prevCursor === '' ? null : prevCursor);
    }
  }

  hasUsers(): boolean {
    return this.userData && this.userData.length > 0;
  }
}