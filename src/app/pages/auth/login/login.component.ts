import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, ResetPasswordRequest } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { ThemeService } from '../../../services/theme.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  forgotPasswordForm: FormGroup;
  resetPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  requiresVerification = false;
  verificationData: any = null;
  isLoadingGoogle = false;
  isRegistrationMode = false;
  
  // Forgot password properties
  showForgotPasswordModal = false;
  isForgotPasswordLoading = false;
  forgotPasswordError = '';
  forgotPasswordSuccess = '';
  
  // Reset password properties
  showResetForm = false;
  isResetPasswordLoading = false;
  resetPasswordError = '';
  resetPasswordSuccess = '';
  
  // Password visibility toggles
  showLoginPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Theme
  isDarkMode = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private notificationService: NotificationService,
    private themeService: ThemeService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    
    this.resetPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
    
    // Subscribe to theme changes
    this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  // Password match validator
  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  ngOnInit(): void {
    // Check for token in URL (Google authentication redirect)
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.isLoading = true;
        this.errorMessage = '';
        
        // Process the token
        this.authService.processAuthToken(token).subscribe({
          next: () => {
            this.isLoading = false;
            this.router.navigate(['/']);
          },
          error: (error) => {
            this.isLoading = false;
            this.errorMessage = 'Authentication failed. Please try again.';
            console.error('Token processing error:', error);
          }
        });
      }
      
      if (params['registered'] === 'true') {
        this.successMessage = 'Registration successful! Please log in with your credentials.';
        
        // Clear success message after a few seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      }
    });
    
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/']);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      // Mark fields as touched to trigger validation error display
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Login successful');
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Login error:', error);
        this.errorMessage = error.message || 'Invalid email or password';
      }
    });
  }

  // New helper method to handle verification flow
  private handleVerificationRequired(): void {
    // Display a temporary notification
    this.successMessage = 'Verification code has been sent to your email. Redirecting to verification page...';
    
    // Clear error message if any
    this.errorMessage = '';
    
    // After a short delay, navigate to verification page
    setTimeout(() => {
      this.router.navigate(['/auth/verify'], { 
        state: { 
          email: this.loginForm.value.email,
          password: this.loginForm.value.password
        } 
      });
    }, 2000);
  }

  signInWithGoogle(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Ensure we're using the correct base URL with HTTPS
    const currentUrl = window.location.href;
    if (!currentUrl.startsWith(environment.appBaseUrl)) {
      window.location.href = currentUrl.replace(
        `${window.location.protocol}//${window.location.host}`,
        environment.appBaseUrl
      );
      return;
    }
    
    try {
      // Get current URL to use as return URL after authentication
      const returnUrl = this.router.url;
      this.authService.googleLogin(returnUrl).subscribe({
        error: (error) => {
          console.error('Google login error:', error);
          this.isLoading = false;
          this.errorMessage = 'Failed to initialize Google sign-in. Please try again later.';
        }
      });
    } catch (error) {
      console.error('Google Sign-In initialization error:', error);
      this.isLoading = false;
      this.errorMessage = 'Failed to initialize Google sign-in. Please try again later.';
    }
  }
  
  // Forgot password methods
  forgotPassword(): void {
    this.showForgotPasswordModal = true;
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    this.showResetForm = false;
    
    // If there's an email in the login form, copy it to the forgot password form
    if (this.loginForm.get('email')?.valid) {
      this.forgotPasswordForm.patchValue({
        email: this.loginForm.get('email')?.value
      });
    }
  }
  
  onForgotPasswordSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      Object.keys(this.forgotPasswordForm.controls).forEach(key => {
        const control = this.forgotPasswordForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.isForgotPasswordLoading = true;
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    
    const email = this.forgotPasswordForm.get('email')?.value;
    
    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        this.isForgotPasswordLoading = false;
        this.forgotPasswordSuccess = response.message || 'Password reset code has been sent to your email';
        
        // Prepare for password reset
        this.showResetForm = true;
        this.resetPasswordForm.patchValue({
          email: email
        });
      },
      error: (error) => {
        this.isForgotPasswordLoading = false;
        this.forgotPasswordError = error.message || 'Failed to send password reset code';
      }
    });
  }
  
  onResetPasswordSubmit(): void {
    if (this.resetPasswordForm.invalid) {
      Object.keys(this.resetPasswordForm.controls).forEach(key => {
        const control = this.resetPasswordForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.isResetPasswordLoading = true;
    this.resetPasswordError = '';
    this.resetPasswordSuccess = '';
    
    const resetData: ResetPasswordRequest = {
      email: this.resetPasswordForm.get('email')?.value,
      code: this.resetPasswordForm.get('code')?.value,
      newPassword: this.resetPasswordForm.get('newPassword')?.value
    };
    
    this.authService.resetPassword(resetData).subscribe({
      next: (response) => {
        this.isResetPasswordLoading = false;
        this.resetPasswordSuccess = response.message || 'Password has been reset successfully';
        
        // Close the modal after a delay
        setTimeout(() => {
          this.showForgotPasswordModal = false;
          this.successMessage = 'Password has been reset successfully. Please log in with your new password.';
        }, 2000);
      },
      error: (error) => {
        this.isResetPasswordLoading = false;
        this.resetPasswordError = error.message || 'Failed to reset password';
      }
    });
  }
} 