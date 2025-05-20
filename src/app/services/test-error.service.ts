import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TestErrorService {
  constructor() {}

  /**
   * Simulates a connection error by logging ERR_CONNECTION_CLOSED to the console.
   * This can be triggered from any component to test the error detection and modal display.
   */
  simulateConnectionError(): void {
    console.error('Testing VPN Modal: ERR_CONNECTION_CLOSED');
  }

  /**
   * Simulates a connection error by throwing an Error with ERR_CONNECTION_CLOSED.
   * This tests the window.addEventListener('error') handler.
   */
  simulateErrorEvent(): void {
    setTimeout(() => {
      throw new Error('Network failed: ERR_CONNECTION_CLOSED');
    }, 100);
  }

  /**
   * Simulates a connection error with a rejected Promise.
   * This tests the window.addEventListener('unhandledrejection') handler.
   */
  simulatePromiseRejection(): void {
    setTimeout(() => {
      Promise.reject(new Error('Fetch error: ERR_CONNECTION_CLOSED'));
    }, 100);
  }
} 