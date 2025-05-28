import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { Subscription, interval } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.css']
})
export class VerifyComponent implements OnInit, OnDestroy {
  verifyForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  email: string = '';
  password: string = '';
  isRegistration: boolean = false;
  timeLeft: number = 300; // 5 minutes in seconds
  timerSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { 
      email: string, 
      password: string,
      isRegistration: boolean
    };
    
    if (state && state.email && state.password) {
      this.email = state.email;
      this.password = state.password;
      this.isRegistration = state.isRegistration || false;
    } else {
      // No state provided - check if we have saved credentials in local storage
      // that we can use instead (the user might have refreshed the page)
      const tempEmail = localStorage.getItem('temp_verify_email');
      const tempPassword = localStorage.getItem('temp_verify_password');
      const tempIsRegistration = localStorage.getItem('temp_is_registration');
      
      if (tempEmail && tempPassword) {
        this.email = tempEmail;
        this.password = tempPassword;
        this.isRegistration = tempIsRegistration === 'true';
      } else {
        this.errorMessage = "Missing verification information. Please try logging in again.";
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 3000);
      }
    }

    // Save credentials temporarily for page refreshes
    if (this.email && this.password) {
      localStorage.setItem('temp_verify_email', this.email);
      localStorage.setItem('temp_verify_password', this.password);
      localStorage.setItem('temp_is_registration', this.isRegistration ? 'true' : 'false');
    }

    this.verifyForm = this.fb.group({
      temporaryCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/']);
    }
    
    // Start countdown timer for code expiration
    this.startTimer();
  }
  
  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }
  
  startTimer(): void {
    this.timerSubscription = interval(1000)
      .pipe(take(this.timeLeft))
      .subscribe({
        next: () => {
          this.timeLeft -= 1;
          if (this.timeLeft <= 0) {
            this.errorMessage = 'Verification code has expired. Please register again.';
            setTimeout(() => {
              this.router.navigate(['/auth/register']);
            }, 3000);
          }
        }
      });
  }
  
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  onSubmit(): void {
    if (this.verifyForm.invalid || !this.email || !this.password) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const verifyData = {
      email: this.email,
      password: this.password,
      temporaryCode: this.verifyForm.value.temporaryCode
    };
    
    if (this.isRegistration) {
      // This is a registration verification
      this.authService.verifyEmail(verifyData).subscribe({
        next: (response) => {
          this.isLoading = false;
          // Clear temporary credentials
          this.clearTempStorage();
          this.router.navigate(['/auth/login'], { 
            queryParams: { verified: 'true' } 
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Invalid verification code';
        }
      });
    } else {
      // This is a regular 2FA verification
      this.authService.verifyCode(verifyData).subscribe({
        next: () => {
          this.isLoading = false;
          // Clear temporary credentials
          this.clearTempStorage();
          this.router.navigate(['/auth/login'], { 
            queryParams: { verified: 'true' } 
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Invalid verification code';
        }
      });
    }
  }
  
  clearTempStorage(): void {
    localStorage.removeItem('temp_verify_email');
    localStorage.removeItem('temp_verify_password');
    localStorage.removeItem('temp_is_registration');
  }
} 