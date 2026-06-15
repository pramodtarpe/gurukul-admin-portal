import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { Router } from '@angular/router';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // CRITICAL FIX: Bypass the interceptor for both login AND refresh endpoints.
  // This prevents the application from getting stuck in an infinite 401 loop.
  if (req.method === 'OPTIONS' || req.url.includes('/api/auth/admin/login') || req.url.includes('/api/auth/refresh')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  let clonedRequest = req;

  if (token) {
    clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      // Catch 401 Unauthorized errors for expired tokens
      if (error.status === 401) {
        
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshToken().pipe(
            switchMap((res: any) => {
              isRefreshing = false;
              const newToken = res.accessToken || authService.getAccessToken();
              refreshTokenSubject.next(newToken);
              
              // Retry the original request (like the logout API call) with the new token
              const retryRequest = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(retryRequest);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              // If the refresh endpoint fails, forcefully clear tokens and route to login
              authService.logout();
              router.navigate(['/auth']);
              return throwError(() => refreshErr);
            })
          );
        } else {
          // If a refresh is already in progress, queue subsequent requests until it finishes
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(token => {
              const retryRequest = req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
              });
              return next(retryRequest);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};