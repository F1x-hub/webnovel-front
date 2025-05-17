import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-google-callback',
  templateUrl: './google-callback.component.html',
  styleUrls: ['./google-callback.component.css']
})
export class GoogleCallbackComponent implements OnInit {
  isLoading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Force HTTPS in production if not already using it
    if (location.protocol === 'http:' && !location.hostname.includes('localhost')) {
      window.location.href = location.href.replace('http:', 'https:');
      return;
    }

    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const error = params['error'];
      
      if (error) {
        this.isLoading = false;
        this.errorMessage = `Authentication failed: ${error}`;
        return;
      }
      
      if (token) {
        // Process the token using the new method
        this.authService.processAuthToken(token).subscribe({
          next: () => {
            this.isLoading = false;
            this.router.navigate(['/']);
          },
          error: (error) => {
            console.error('Error processing authentication token:', error);
            this.isLoading = false;
            this.errorMessage = 'Failed to authenticate. Please try again.';
          }
        });
      } else {
        // If we don't have a token but no error either, something went wrong
        this.isLoading = false;
        this.errorMessage = 'No authentication data received. Please try again.';
      }
    });
  }

  returnToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
