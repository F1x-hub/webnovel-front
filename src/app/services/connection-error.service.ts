import { Injectable, EventEmitter } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

type XhrOpenFunction = (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) => void;

@Injectable({
  providedIn: 'root'
})
export class ConnectionErrorService {
  public showModal$ = new EventEmitter<boolean>();
  private errorPattern = 'ERR_CONNECTION_CLOSED';
  private originalConsoleError: any;
  private originalFetch: any;
  private originalXhrOpen!: XhrOpenFunction;
  
  constructor() {
    this.setupErrorHandler();
    this.interceptNetworkRequests();
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
  
  private interceptNetworkRequests(): void {
    // Intercept fetch requests
    this.originalFetch = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      return this.originalFetch(...args)
        .catch((error: Error) => {
          const errorString = String(error);
          if (errorString.includes(this.errorPattern)) {
            this.showVpnModal();
          }
          throw error;
        });
    };
    
    // Intercept XMLHttpRequest
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    const self = this;
    
    // Override XMLHttpRequest.open
    XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
      const xhr = this;
      const originalOnError = xhr.onerror;
      
      xhr.onerror = function(this: XMLHttpRequest, event: ProgressEvent<EventTarget>) {
        if (originalOnError) {
          originalOnError.call(this, event);
        }
        
        // Check if this is a connection closed error
        if (xhr.status === 0) {
          // Most connection errors result in status 0
          const urlString = url.toString();
          if (urlString.includes('api.webnovel-project.click')) {
            console.error('XHR Error: net::ERR_CONNECTION_CLOSED');
          }
        }
      };
      
      return self.originalXhrOpen.call(xhr, method, url, async, username, password);
    } as XhrOpenFunction;
  }
  
  private showVpnModal(): void {
    this.showModal$.emit(true);
  }
  
  /**
   * Shows the VPN error modal
   * This can be called directly from other services or components
   */
  public showVpnErrorModal(): void {
    this.showModal$.emit(true);
  }
  
  public hideVpnModal(): void {
    this.showModal$.emit(false);
  }
  
  // Clean up when service is destroyed
  public destroyHandler(): void {
    console.error = this.originalConsoleError;
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXhrOpen;
    window.removeEventListener('unhandledrejection', this.showVpnModal);
    window.removeEventListener('error', this.showVpnModal);
  }
} 