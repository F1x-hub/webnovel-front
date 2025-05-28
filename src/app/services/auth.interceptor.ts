import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router, private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Get the current user from auth service
    const currentUser = this.authService.currentUserValue;
    
    // Check if we need to add auth token
    if (currentUser?.token) {
      // Clone the request and add the auth header
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${currentUser.token}`
        }
      });
      
      console.log(`Adding auth token to request: ${request.url}`);
    }
    
    // Pass the cloned request to the next handler
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.log('Auth error - 401 Unauthorized');
          // Optionally: Redirect to login page or refresh token
          // this.router.navigate(['/auth/login']);
        } else if (error.status === 403) {
          console.log('Auth error - 403 Forbidden');
          // Log user info to help debug the issue
          console.log('Current user roleId:', currentUser?.roleId);
          console.log('Token present:', !!currentUser?.token);
        }
        
        return throwError(() => error);
      })
    );
  }
} 