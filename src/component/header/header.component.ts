import { Component, OnInit, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../service/auth/auth.service';
import { CommunicationService } from '../../service/communication/communication.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'ga-header',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // <-- Added ReactiveFormsModule here
  providers: [CommunicationService],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private communicationService = inject(CommunicationService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private fb = inject(FormBuilder);

  profileData: any = null;
  isDropdownOpen = false;
  isLoggingOut = false;

  // --- Edit Profile State ---
  isEditModalOpen = false;
  isUpdatingProfile = false;
  profileForm: FormGroup;

  constructor() {
    // Initialize the form with basic validation
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.pattern('^[0-9+ -]*$')]]
    });
  }

  ngOnInit() {
    this.fetchProfile();
  }

  fetchProfile() {
    this.communicationService.getAdminProfile().subscribe({
      next: (data) => {
        this.profileData = data;
      },
      error: (err) => {
        console.error('Failed to load admin profile', err);
      }
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  // --- Edit Profile Methods ---
  openEditModal() {
    this.isDropdownOpen = false; // Close the dropdown menu
    this.isEditModalOpen = true; // Open the modal

    // Pre-fill the form with existing data
    if (this.profileData) {
      this.profileForm.patchValue({
        name: this.profileData.name || '',
        phoneNumber: this.profileData.phoneNumber || ''
      });
    }
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.profileForm.reset();
  }

  onSaveProfile() {
    if (this.profileForm.invalid) return;

    this.isUpdatingProfile = true;
    const updatedData = this.profileForm.value;

    this.communicationService.updateAdminProfile(updatedData)
      .pipe(finalize(() => this.isUpdatingProfile = false))
      .subscribe({
        next: () => {
          // Instantly update the local UI without needing to refresh the page
          this.profileData.name = updatedData.name;
          this.profileData.phoneNumber = updatedData.phoneNumber;
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Failed to update profile', err);
          alert('Failed to update profile. Please try again.');
        }
      });
  }

  // --- Session Methods ---
  onLogout(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    this.authService.logoutApi()
      .pipe(
        finalize(() => {
          this.authService.logout();
          this.router.navigate(['/auth']);
          this.isLoggingOut = false;
          this.isDropdownOpen = false;
        })
      )
      .subscribe({
        error: (err) => {
          console.warn('Server logout failed, clearing local session anyway.', err);
        }
      });
  }
}