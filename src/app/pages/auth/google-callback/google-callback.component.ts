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
    console.log('Google callback initiated, current URL:', window.location.href);
    
    // Ensure we're using HTTPS
    if (window.location.protocol === 'http:') {
      console.warn('Protocol is HTTP, redirecting to HTTPS...');
      window.location.href = window.location.href.replace('http:', 'https:');
      return;
    }

    this.route.queryParams.subscribe(params => {
      console.log('Query parameters received:', params);
      
      const token = params['token'];
      const error = params['error'];
      
      if (error) {
        this.isLoading = false;
        this.errorMessage = `Authentication failed: ${error}`;
        console.error('Authentication error from query params:', error);
        return;
      }
      
      if (token) {
        console.log('Token received, processing...');
        // Process the token
        this.authService.processAuthToken(token).subscribe({
          next: () => {
            console.log('Token processed successfully, redirecting to home');
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
        console.warn('No token or error received in callback');
      }
    });
  }

  returnToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
