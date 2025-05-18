import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-google-auth-redirect',
  template: `<div class="d-flex justify-content-center align-items-center vh-100">
    <div class="text-center">
      <div class="spinner-border text-primary mb-3" role="status"></div>
      <p>Redirecting to Google authentication...</p>
    </div>
  </div>`,
  styles: []
})
export class GoogleAuthRedirectComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const mode = params['mode'] || 'login';
      const returnUrl = params['returnUrl'] || '/';
      
      // Always use HTTPS for Google OAuth
      const apiUrl = environment.apiUrl.replace(/^http:/i, 'https:');
      const appUrl = window.location.origin.replace(/^http:/i, 'https:');
      const callbackUrl = `${appUrl}/auth/callback`;
      
      // Redirect to backend with secure URLs
      window.location.href = `${apiUrl}/api/Auth/google-login?returnUrl=${encodeURIComponent(callbackUrl)}&mode=${mode}`;
    });
  }
} 