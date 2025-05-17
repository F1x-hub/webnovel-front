import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AgeVerificationService } from './services/age-verification.service';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'WebNovel';
  private modalSubscription?: Subscription;
  
  constructor(
    private ageVerificationService: AgeVerificationService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Enforce HTTPS in production
    this.enforceHttps();
    
    // Listen for user authentication changes
    this.authService.currentUser$.subscribe(user => {
      // If user logs in and is already verified as adult, no need to show verification
      if (user?.isAdult) {
        this.ageVerificationService.hideVerificationModal();
      }
    });
  }
  
  private enforceHttps(): void {
    if (environment.production && 
        window.location.protocol === 'http:' && 
        !window.location.hostname.includes('localhost')) {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }
  
  ngOnDestroy(): void {
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }
  }
}
