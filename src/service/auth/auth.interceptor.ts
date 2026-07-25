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

  // BYPASS: Prevent infinite loops by ignoring login and refresh endpoints
  if (req.method === 'OPTIONS' || req.url.includes('/api/auth/admin/login') || req.url.includes('/api/auth/refresh')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  let clonedRequest = req;
  
  if (token) {
    clonedRequest = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
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
            // FIX: Catch errors HERE so it only triggers if the actual Refresh API fails
            catchError((refreshErr) => {
              isRefreshing = false;
              authService.logout();
              router.navigate(['/auth']);
              return throwError(() => refreshErr);
            }),
            // If refresh is successful, proceed to retry the original request
            switchMap((res: any) => {
              isRefreshing = false;
              
              // The new access token is safely extracted
              const newAccessToken = res.accessToken || authService.getAccessToken();
              refreshTokenSubject.next(newAccessToken);
              
              const retryRequest = req.clone({
                setHeaders: { Authorization: `Bearer ${newAccessToken}` }
              });
              return next(retryRequest);
            })
          );
        } else {
          // If a refresh is already in progress, queue subsequent requests
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