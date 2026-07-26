import { Component, inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../service/auth/auth.service';

declare var google: any;
type AuthView = 'login' | 'forgot-email' | 'otp-verify' | 'success';

@Component({
  selector: 'ga-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private readonly GOOGLE_CLIENT_ID = '734008277602-2kbgora11e7hnjsmrb5o0eivb73v6ujr.apps.googleusercontent.com';

  isLoading = false;
  errorMessage = '';
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  currentView: AuthView = 'login';
  emailSentMessage = '';
  successMessage = '';

  otpDigits: string[] = ['', '', '', '', '', ''];

  ngOnInit(): void {
    this.loadGoogleScript();
  }
  // --- NEW: Google Authentication Methods ---
  private loadGoogleScript(): void {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.renderGoogleButton();
    };
    document.body.appendChild(script);
  }

  private renderGoogleButton(): void {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.initialize({
        client_id: this.GOOGLE_CLIENT_ID,
        callback: this.handleGoogleCredentialResponse.bind(this)
      });
      const container = document.getElementById('googleSignInContainer');
      if (container) {
        google.accounts.id.renderButton(
          container,
          { theme: 'outline', size: 'large', width: 400, shape: 'rectangular' }
        );
      }
    }
  }

  private handleGoogleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      const token = response.credential;

      this.isLoading = true;
      this.errorMessage = '';

      this.authService.googleLogin(token).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['']);
        },
        error: (err: any) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Google Sign-In failed. Please try again.';
        }
      });
    });
  }
  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  forgotEmailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  // MERGED FORM: Now securely handles both the OTP digits and the New Passwords together
  resetPasswordForm = this.fb.nonNullable.group({
    otp1: [''],
    otp2: [''],
    otp3: [''],
    otp4: [''],
    otp5: [''],
    otp6: [''],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordsMatchValidator });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  passwordsMatchValidator(form: any) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  handleOtpPaste(event: ClipboardEvent, startIndex: number) {
    event.preventDefault();
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;

    let pastedText = clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - startIndex);

    for (let i = 0; i < pastedText.length && (startIndex + i) < 6; i++) {
      const idx = startIndex + i;
      this.otpDigits[idx] = pastedText[i];
      const fieldName = `otp${idx + 1}` as keyof typeof this.resetPasswordForm.value;
      this.resetPasswordForm.patchValue({ [fieldName]: pastedText[i] });
    }

    const focusIndex = Math.min(startIndex + pastedText.length, 5);
    (document.getElementById(`otp${focusIndex + 1}`) as HTMLInputElement)?.focus();
  }

  handleOtpInput(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.slice(-1).replace(/[^0-9]/g, '');

    this.otpDigits[index] = value || '';
    const fieldName = `otp${index + 1}` as keyof typeof this.resetPasswordForm.value;
    this.resetPasswordForm.patchValue({ [fieldName]: value });

    if (value && index < 5) {
      (document.getElementById(`otp${index + 2}`) as HTMLInputElement)?.focus();
    } else if (!value && index > 0) {
      (document.getElementById(`otp${index}`) as HTMLInputElement)?.focus();
    }
  }

  handleOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      if (this.otpDigits[index]) {
        this.otpDigits[index] = '';
        const fieldName = `otp${index + 1}` as keyof typeof this.resetPasswordForm.value;
        this.resetPasswordForm.patchValue({ [fieldName]: '' });
        return;
      }
      if (index > 0) {
        const prevIndex = index - 1;
        this.otpDigits[prevIndex] = '';
        (document.getElementById(`otp${prevIndex + 1}`) as HTMLInputElement)?.focus();
        this.resetPasswordForm.patchValue({ [`otp${prevIndex + 1}`]: '' });
      }
    }
  }

  isOtpComplete(): boolean {
    return this.otpDigits.every(d => d.length === 1);
  }

  getFullOtp(): string {
    return this.otpDigits.join('');
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    const credentials = this.loginForm.getRawValue();

    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Invalid administrative credentials. Please try again.';
      }
    });
  }

  onSendOtp(): void {
    if (this.forgotEmailForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.emailSentMessage = '';
    const email = this.forgotEmailForm.get('email')!.value!;
    this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.isLoading = false;
        this.emailSentMessage = `A 6-digit verification OTP has been sent to ${email}.`;
        this.currentView = 'otp-verify';
        // ADDED: Force focus on the first OTP input box after Angular renders the view
        setTimeout(() => {
          document.getElementById('otp1')?.focus();
        }, 0);
      },
      error: (err: any) => {
        this.isLoading = false;
        if (err?.status === 429) {
          this.errorMessage = 'You have reached the maximum request limit. Please try again later.';
        } else {
          // Fallback to the backend error message or the generic default
          this.errorMessage = err?.error?.message || 'Failed to send OTP. Please try again.';
        }
      }
    });
  }

  onResetPassword(): void {
    if (this.resetPasswordForm.invalid || !this.isOtpComplete()) return;

    this.isLoading = true;
    this.errorMessage = '';

    const otp = this.getFullOtp();
    const email = this.forgotEmailForm.get('email')!.value!;
    const newPassword = this.resetPasswordForm.get('newPassword')!.value!;

    this.authService.resetPassword({ email, otp, newPassword }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Your password has been changed successfully. You can now log in with your new password.';
        this.currentView = 'success';
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Password reset failed. Please try again.';
      }
    });
  }

  goBackToLogin(): void {
    this.currentView = 'login';
    this.errorMessage = '';
    this.emailSentMessage = '';
    this.successMessage = '';

    this.forgotEmailForm.reset();
    this.resetPasswordForm.reset();
    this.otpDigits = ['', '', '', '', '', ''];

    // Wait for Angular's *ngIf to inject the login container back into the DOM, then render the button
    setTimeout(() => {
      this.renderGoogleButton();
    }, 50);
  }
}