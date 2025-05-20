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
import { ConnectionErrorService } from './connection-error.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkErrorService implements HttpInterceptor {
  
  constructor(private connectionErrorService: ConnectionErrorService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Check for connection errors that might indicate ERR_CONNECTION_CLOSED
        if (!error.status || error.status === 0) {
          console.error('Network error intercepted:', error);
          
          // If error message or statusText contains our error pattern
          const errorMessage = error.message || '';
          const statusText = error.statusText || '';
          const url = request.url || '';
          
          // Network errors often come as ProgressEvent
          const isNetworkError = error.error instanceof ProgressEvent;
          
          // Check if this is likely a connection closed error
          if (
            errorMessage.includes('ERR_CONNECTION_CLOSED') || 
            statusText.includes('ERR_CONNECTION_CLOSED') ||
            (isNetworkError && url.includes('api.webnovel-project.click'))
          ) {
            console.error('Connection error detected. Show VPN modal');
            // Use the public method to show the VPN modal
            this.connectionErrorService.showVpnErrorModal();
          }
        }
        
        return throwError(() => error);
      })
    );
  }
}
