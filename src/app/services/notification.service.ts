import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor() {}

  /**
   * Show a success notification
   */
  success(message: string): void {
    console.log('Success notification:', message);
    // Implement your preferred notification method here
    // For now, we'll just use an alert as a basic implementation
    this.showNotification('success', message);
  }

  /**
   * Show an info notification
   */
  info(message: string): void {
    console.log('Info notification:', message);
    this.showNotification('info', message);
  }

  /**
   * Show an error notification
   */
  error(message: string): void {
    console.error('Error notification:', message);
    this.showNotification('error', message);
  }

  /**
   * Show a warning notification
   */
  warning(message: string): void {
    console.warn('Warning notification:', message);
    this.showNotification('warning', message);
  }

  /**
   * Basic implementation of notification display
   * In a real app, you would use a proper notification library or component
   */
  private showNotification(type: 'success' | 'info' | 'error' | 'warning', message: string): void {
    // Simple alert for now, but could be replaced with a proper UI component
    // In a real application, you would use something like ngx-toastr, angular material snackbar, etc.
    const fullMessage = `${type.toUpperCase()}: ${message}`;
    
    if (type === 'error') {
      alert(fullMessage);
    } else {
      // For non-errors, we'll just log to console to avoid too many alerts during development
      console.log(fullMessage);
    }
  }
} 