import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private readonly API_URL: string = `${environment.apiBase}/api/auth/admin/login`;

  isAuthenticated = signal<boolean>(this.hasToken());

  login(credentials: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.API_URL, credentials).pipe(
      tap(response => this.handleAuthentication(response))
    );
  }

  forgotPassword(payload: { email: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiBase}/api/auth/forgot-password`, payload);
  }

  resetPassword(payload: { email: string; otp: string; newPassword: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiBase}/api/auth/reset-password`, payload);
  }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    const userStr = localStorage.getItem('admin_user'); 

    if (!refreshToken || !userStr) {
      this.logout();
      return throwError(() => new Error('Missing token or user data for refresh'));
    }
    
    const user = JSON.parse(userStr);
    const email = user.email;

    return this.http.post<any>(`${environment.apiBase}/api/auth/refresh`, { email, refreshToken }).pipe(
      tap((response: any) => {
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
    return this.http.post<any>(`${environment.apiBase}/api/auth/logout`, {});
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