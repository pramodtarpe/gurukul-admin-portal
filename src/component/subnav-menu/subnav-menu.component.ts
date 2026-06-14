// subnav-menu.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../service/auth/auth.service';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'ga-subnav-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './subnav-menu.component.html',
  styleUrls: ['./subnav-menu.component.scss']
})
export class SubnavMenuComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  isLoggingOut = false; // State to prevent multiple clicks

  onLogout(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    // Call the server to invalidate the token
    this.authService.logoutApi()
      .pipe(
        // finalize runs whether the API call succeeds OR fails
        finalize(() => {
          // 1. Clear tokens locally and flip signal
          this.authService.logout();

          // 2. Redirect back to login
          this.router.navigate(['/auth']);
          this.isLoggingOut = false;
        })
      )
      .subscribe({
        error: (err) => {
          console.warn('Server logout failed, clearing local session anyway.', err);
        }
      });
  }
}