import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-age-verification-modal',
  templateUrl: './age-verification-modal.component.html',
  styleUrls: ['./age-verification-modal.component.css']
})
export class AgeVerificationModalComponent {
  @Input() novelId?: number | null;
  @Output() verificationComplete = new EventEmitter<boolean>();
  
  isProcessing = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  confirmAdult(): void {
    // Check if user is logged in
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      // User is not logged in, redirect to login page
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';

    // Call API to set user as adult
    this.authService.setUserAsAdult(currentUser.id as number).subscribe({
      next: () => {
        // Update local user data
        if (currentUser) {
          currentUser.isAdult = true;
          this.authService.updateStoredUserData(currentUser);
        }
        this.isProcessing = false;
        this.verificationComplete.emit(true);
        
        // If novel ID is provided, navigate to the novel page
        if (this.novelId) {
          this.router.navigate(['/novel', this.novelId]);
        }
      },
      error: (err) => {
        console.error('Error setting user as adult:', err);
        this.errorMessage = err.message || 'Failed to verify age. Please try again.';
        this.isProcessing = false;
        this.verificationComplete.emit(false);
      }
    });
  }

  rejectAdult(): void {
    // Navigate back to home page
    this.router.navigate(['/']);
    this.verificationComplete.emit(false);
  }
} 