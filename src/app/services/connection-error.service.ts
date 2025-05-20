import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConnectionErrorService {
  public showModal$ = new EventEmitter<boolean>();
  private errorPattern = 'ERR_CONNECTION_CLOSED';
  private originalConsoleError: any;
  
  constructor() {
    this.setupErrorHandler();
  }
  
  private setupErrorHandler(): void {
    // Save the original console.error
    this.originalConsoleError = console.error;
    
    // Override console.error
    console.error = (...args: any[]) => {
      // Call the original console.error
      this.originalConsoleError.apply(console, args);
      
      // Check if any argument contains our error pattern
      const errorString = args.map(arg => String(arg)).join(' ');
      if (errorString.includes(this.errorPattern)) {
        this.showVpnModal();
      }
    };
    
    // Also listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const errorString = String(event.reason);
      if (errorString.includes(this.errorPattern)) {
        this.showVpnModal();
      }
    });
    
    // And listen for error events
    window.addEventListener('error', (event) => {
      const errorString = String(event.error || event.message);
      if (errorString.includes(this.errorPattern)) {
        this.showVpnModal();
      }
    });
  }
  
  private showVpnModal(): void {
    this.showModal$.emit(true);
  }
  
  public hideVpnModal(): void {
    this.showModal$.emit(false);
  }
  
  // Clean up when service is destroyed
  public destroyHandler(): void {
    console.error = this.originalConsoleError;
    window.removeEventListener('unhandledrejection', this.showVpnModal);
    window.removeEventListener('error', this.showVpnModal);
  }
} 