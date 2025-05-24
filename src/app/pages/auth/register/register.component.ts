import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      isAdult: [false],
      roleId: [1] // Устанавливаем 1 для обычного пользователя по умолчанию
    });
  }

  ngOnInit(): void {
    if (this.authService.isLoggedIn) {
      this.router.navigate(['/']);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    // Prepare form data for submission
    const formValue = {...this.registerForm.value};
    
    // Убедиться, что roleId установлен в 1 для обычных пользователей
    formValue.roleId = 1;

    // Add selected file if exists
    if (this.selectedFile) {
      formValue.profileImage = this.selectedFile;
    }

    console.log('Submitting registration form with values:', formValue);
    
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(formValue).subscribe({
      next: (response) => {
        console.log('Registration success:', response);
        this.isLoading = false;
        // Wait a moment before redirecting to login page
        this.errorMessage = '';
        this.registerForm.reset();
        
        setTimeout(() => {
          this.router.navigate(['/auth/login'], { 
            queryParams: { registered: 'true' } 
          });
        }, 1000);
      },
      error: (error) => {
        console.error('Registration error:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'An error occurred during registration';
        
        // If there are field-specific errors, set them on the form controls
        if (error.originalError?.error?.errors) {
          const errors = error.originalError.error.errors;
          Object.keys(errors).forEach(key => {
            const fieldName = key.charAt(0).toLowerCase() + key.slice(1);
            const control = this.registerForm.get(fieldName);
            if (control) {
              control.setErrors({ serverError: errors[key][0] });
            }
          });
        }
      }
    });
  }
} 