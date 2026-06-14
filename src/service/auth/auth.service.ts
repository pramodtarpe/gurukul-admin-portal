// auth.service.ts
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
  
  // RELATIVE PATHS: The proxy configuration automatically prepends the AWS target domain
  private readonly API_URL = '/api/auth/admin/login';

  isAuthenticated = signal<boolean>(this.hasToken());

  login(credentials: any): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.API_URL, credentials).pipe(
      tap(response => this.handleAuthentication(response))
    );
  }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }
    
    // Relative path for token refresh
    const refreshUrl = '/api/auth/admin/refresh';
    return this.http.post<any>(refreshUrl, { refreshToken }).pipe(
      tap(response => {
        if (response?.accessToken) {
          localStorage.setItem('access_token', response.accessToken);
        }
      })
    );
  }

  // NEW: Call the backend to invalidate the session
  logoutApi(): Observable<any> {
    return this.http.post('/api/auth/logout', {});
  }

  // EXISTING: Purely local cleanup (Used by interceptor and after API success)
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