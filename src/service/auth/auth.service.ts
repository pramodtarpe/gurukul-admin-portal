import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';

export interface LoginResponse {
  message: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly API_URL = '/api/auth/admin/login';

  isAuthenticated = signal<boolean>(this.hasToken());

  login(credentials: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.API_URL, credentials).pipe(
      tap(response => this.handleAuthentication(response))
    );
  }

  // --- NEW METHODS ADDED HERE ---
  forgotPassword(payload: { email: string }): Observable<any> {
    return this.http.post('/api/auth/forgot-password', payload);
  }

  resetPassword(payload: { email: string; otp: string; newPassword: string }): Observable<any> {
    return this.http.post('/api/auth/reset-password', payload);
  }
  // ------------------------------

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    const userStr = localStorage.getItem('admin_user'); 

    if (!refreshToken || !userStr) {
      this.logout();
      return throwError(() => new Error('Missing token or user data for refresh'));
    }
    
    // Extract the email required for the JSON payload
    const user = JSON.parse(userStr);
    const email = user.email;

    // Hit the correct refresh endpoint with the required body
    return this.http.post<any>('/api/auth/refresh', { email, refreshToken }).pipe(
      tap(response => {
        if (response?.accessToken) {
          localStorage.setItem('access_token', response.accessToken);
        }
        if (response?.refreshToken) {
          localStorage.setItem('refresh_token', response.refreshToken);
        }
      })
    );
  }

  logoutApi(): Observable<any> {
    return this.http.post('/api/auth/logout', {});
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('admin_user');
    this.isAuthenticated.set(false);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('access_token');
  }

  private handleAuthentication(response: LoginResponse): void {
    localStorage.setItem('access_token', response.accessToken);
    localStorage.setItem('refresh_token', response.refreshToken);
    localStorage.setItem('admin_user', JSON.stringify({ name: response.name, email: response.email }));
    this.isAuthenticated.set(true);
  }
}