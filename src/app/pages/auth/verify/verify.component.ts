import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.css']
})
export class VerifyComponent implements OnInit {
  verifyForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  email: string = '';
  password: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { email: string, password: string };
    
    if (state && state.email && state.password) {
      this.email = state.email;
      this.password = state.password;
    } else {
      // No state provided - check if we have saved credentials in local storage
      // that we can use instead (the user might have refreshed the page)
      const tempEmail = localStorage.getItem('temp_verify_email');
      const tempPassword = localStorage.getItem('temp_verify_password');
      
      if (tempEmail && tempPassword) {
        this.email = tempEmail;
        this.password = tempPassword;
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
    }

    this.verifyForm = this.fb.group({
      temporaryCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/']);
    }
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

    this.authService.verifyCode(verifyData).subscribe({
      next: () => {
        this.isLoading = false;
        // Clear temporary credentials
        localStorage.removeItem('temp_verify_email');
        localStorage.removeItem('temp_verify_password');
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Invalid verification code';
      }
    });
  }
} 