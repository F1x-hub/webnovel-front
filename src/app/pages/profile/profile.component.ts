import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService, ChangePasswordRequest } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { NovelService } from '../../services/novel.service';
import { Novel } from '../../components/novel-card/novel-card.component';

export interface UserProfile {
  id: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  roleId: number;
  roleName?: string;
  imageUrl?: string;
  memberSince?: Date;
  createdAt?: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ProfileComponent implements OnInit, OnDestroy {
  userProfile: UserProfile | null = null;
  profileForm!: FormGroup;
  isEditing = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  memberSince = '';
  booksRead = 0;
  currentUserId: number | null = null;
  viewingUserId: number | null = null;
  isOwnProfile = true;
  // Track the current timestamp for image URLs to prevent ExpressionChangedAfterItHasBeenCheckedError
  imageTimestamp: number = Date.now();
  isDarkMode = true;
  private themeSubscription: Subscription;
  // Store the cached image to avoid re-fetching
  cachedProfileImage: string | null = null;
  
  // Novels carousel properties
  userNovels: Novel[] = [];
  isLoadingNovels = false;
  currentSlide = 0;

  // Change password properties
  changePasswordForm!: FormGroup;
  showChangePasswordModal = false;
  isChangePasswordLoading = false;
  changePasswordError = '';
  changePasswordSuccess = '';
  
  // Password visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    public authService: AuthService,
    private themeService: ThemeService,
    public router: Router,
    private route: ActivatedRoute,
    private novelService: NovelService,
    private ngZone: NgZone
  ) {
    this.initForm();
    this.initChangePasswordForm();
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      // Force a refresh of the image timestamp when theme changes to ensure consistent appearance
      this.imageTimestamp = Date.now();
    });
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.id || null;
    
    // Check if we're viewing someone else's profile via route param
    this.route.paramMap.subscribe(params => {
      const userId = params.get('id');
      if (userId) {
        this.viewingUserId = Number(userId);
        this.isOwnProfile = this.currentUserId === this.viewingUserId;
        this.loadUserProfileById(this.viewingUserId);
        this.loadUserNovels(this.viewingUserId);
      } else {
        this.isOwnProfile = true;
        this.loadUserProfile();
        if (this.currentUserId) {
          this.loadUserNovels(this.currentUserId);
        }
      }
    });
    
    // Load cached profile image if available
    if (this.currentUserId) {
      this.loadCachedProfileImage(this.currentUserId);
    }
    
    // Update dark mode status
    this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription when component is destroyed
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  initForm(): void {
    this.profileForm = this.formBuilder.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required]
    });
  }

  initChangePasswordForm(): void {
    this.changePasswordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

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

  loadUserProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.tryLoadProfile();
  }

  loadUserProfileById(userId: number): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.userService.getUserProfile(userId).subscribe({
      next: (profile) => {
        console.log('Profile loaded successfully:', profile);
        this.userProfile = profile;
        
        // Format member since date (try both memberSince and createdAt properties)
        const dateValue = profile.memberSince || profile.createdAt;
        if (dateValue) {
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              this.memberSince = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            } else {
              console.warn('Invalid date format:', dateValue);
              this.memberSince = 'Member';
            }
          } catch (e) {
            console.error('Error formatting date:', e, 'Value was:', dateValue);
            this.memberSince = 'Member';
          }
        } else {
          this.memberSince = 'New member';
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.errorMessage = error.message || 'Failed to load profile. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  loadUserNovels(userId: number): void {
    this.isLoadingNovels = true;
    
    this.novelService.getUserNovels(userId).subscribe({
      next: (novels) => {
        // Set the image URL for each novel using the service
        this.userNovels = novels.map(novel => {
          if (novel.id) {
            novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
          }
          return novel;
        });
        this.isLoadingNovels = false;
      },
      error: (error) => {
        console.error('Error loading user novels:', error);
        this.isLoadingNovels = false;
      }
    });
  }

  private loadCachedProfileImage(userId: number): void {
    this.userService.getProfileImageWithCache(userId).subscribe({
      next: (imageData) => {
        this.cachedProfileImage = imageData;
      },
      error: (error) => {
        console.error('Error loading cached profile image:', error);
      }
    });
  }

  private tryLoadProfile(isRetry = false): void {
    try {
      const userId = this.authService.currentUserValue?.id;
      
      if (!userId) {
        if (!isRetry) {
          console.log('User ID not found, trying to refresh token data...');
          this.refreshAndRetry();
          return;
        }
        this.errorMessage = 'User not found. Please login again.';
        this.isLoading = false;
        return;
      }

      console.log('Loading profile for user ID:', userId);
      this.userService.getCurrentUserProfile().subscribe({
        next: (profile) => {
          console.log('Profile loaded successfully:', profile);
          this.userProfile = profile;
          this.resetForm();
          
          // If profile loaded successfully, make sure we have the cached image
          if (!this.cachedProfileImage) {
            this.loadCachedProfileImage(userId);
          }
          
          // Format member since date (try both memberSince and createdAt properties)
          const dateValue = profile.memberSince || profile.createdAt;
          if (dateValue) {
            try {
              const date = new Date(dateValue);
              if (!isNaN(date.getTime())) {
                this.memberSince = date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              } else {
                console.warn('Invalid date format:', dateValue);
                this.memberSince = 'Member';
              }
            } catch (e) {
              console.error('Error formatting date:', e, 'Value was:', dateValue);
              this.memberSince = 'Member';
            }
          } else {
            this.memberSince = 'New member';
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading profile:', error);
          
          if (!isRetry) {
            console.log('Profile load failed, trying to refresh token data...');
            this.refreshAndRetry();
            return;
          }
          
          this.errorMessage = error.message || 'Failed to load profile. Please try again later.';
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      
      if (!isRetry) {
        console.log('Error caught, trying to refresh token data...');
        this.refreshAndRetry();
        return;
      }
      
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      this.isLoading = false;
    }
  }

  private refreshAndRetry(): void {
    this.authService.refreshUserData().subscribe({
      next: () => {
        console.log('User data refreshed, retrying profile load...');
        this.currentUserId = this.authService.currentUserValue?.id || null;
        this.tryLoadProfile(true);
      },
      error: (error) => {
        console.error('Failed to refresh user data:', error);
        this.errorMessage = 'User profile not found. Please try logging in again.';
        this.isLoading = false;
      }
    });
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing && this.userProfile) {
      this.resetForm();
    } else {
      this.resetMessages();
    }
  }

  resetForm(): void {
    if (this.userProfile) {
      this.profileForm.patchValue({
        userName: this.userProfile.userName || '',
        email: this.userProfile.email || '',
        firstName: this.userProfile.firstName || '',
        lastName: this.userProfile.lastName || ''
      });
    } else {
      // If no profile data, initialize with empty values
      this.profileForm.reset({
        userName: '',
        email: '',
        firstName: '',
        lastName: ''
      });
    }
  }

  resetMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
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

  saveProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    this.resetMessages();
    
    const userId = this.userProfile?.id;
    if (!userId) {
      this.errorMessage = 'User ID not found';
      this.isLoading = false;
      return;
    }
    
    const userData = this.profileForm.value;
    
    this.userService.updateUserProfile(userId, userData).subscribe({
      next: () => {
        this.successMessage = 'Profile updated successfully';
        
        // If there's a selected file, upload it
        if (this.selectedFile) {
          this.uploadProfileImage(userId);
        } else {
          this.isLoading = false;
          this.loadUserProfile(); // Reload profile to show updated data
          this.isEditing = false;
        }
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.errorMessage = error.message || 'Failed to update profile';
        this.isLoading = false;
      }
    });
  }

  uploadProfileImage(userId: number): void {
    if (!this.selectedFile) {
      return;
    }
    
    this.isLoading = true;
    console.log('Uploading profile image for user ID:', userId, 'File:', this.selectedFile.name, 'Size:', this.selectedFile.size);
    
    this.userService.uploadProfileImage(userId, this.selectedFile).subscribe({
      next: (response) => {
        console.log('Image upload successful:', response);
        this.successMessage = 'Profile and image updated successfully';
        
        // Use NgZone to prevent ExpressionChangedAfterItHasBeenCheckedError
        this.ngZone.run(() => {
          // Set loading to false right away
          this.isLoading = false;
          this.isEditing = false;
          
          // Update timestamp for image URLs
          this.imageTimestamp = Date.now();
          
          // Use a timeout for loading the profile to allow UI to settle
          setTimeout(() => {
            this.loadUserProfile();
            this.selectedFile = null;
            this.imagePreview = null;
          }, 200);
        });
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        
        this.ngZone.run(() => {
          if (error.originalError?.status === 0) {
            this.errorMessage = 'Server is unreachable. Please check your internet connection.';
          } else if (error.message) {
            this.errorMessage = `Failed to upload image: ${error.message}`;
          } else {
            this.errorMessage = 'Profile updated but failed to upload image';
          }
          
          this.isLoading = false;
          this.loadUserProfile(); // Still reload profile since user data was updated
        });
      }
    });
  }

  isAdmin(): boolean {
    return this.authService.currentUserValue?.roleName === 'Admin' || 
           this.userProfile?.roleName === 'Admin' || 
           false;
  }

  getImageUrl(url: string | undefined): string {
    // If we have a cached image (in base64 format), use it
    if (this.cachedProfileImage && this.userProfile?.id) {
      return this.cachedProfileImage;
    }
    
    // Fall back to standard URL-based approach
    if (url) {
      return `${url}?t=${this.imageTimestamp}`;
    }
    
    // If no URL provided, check if we can use the user ID to fetch image
    if (this.userProfile?.id) {
      return this.userService.getProfileImageUrl(this.userProfile.id, this.imageTimestamp);
    }
    
    // Fallback to default avatar
    return `assets/images/default-avatar.png?t=${this.imageTimestamp}`;
  }

  // Carousel navigation methods
  nextSlide(): void {
    if (this.currentSlide < this.userNovels.length - 1) {
      this.currentSlide++;
    } else {
      this.currentSlide = 0; // Loop back to the first slide
    }
  }

  prevSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    } else {
      this.currentSlide = this.userNovels.length - 1; // Loop to the last slide
    }
  }

  goToSlide(index: number): void {
    if (index >= 0 && index < this.userNovels.length) {
      this.currentSlide = index;
    }
  }

  navigateToNovel(novelId: number): void {
    this.router.navigate(['/novel', novelId]);
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement && imgElement.src) {
      imgElement.src = 'assets/images/default-cover.png';
    }
  }

  onChangePasswordSubmit(): void {
    if (this.changePasswordForm.invalid) {
      Object.keys(this.changePasswordForm.controls).forEach(key => {
        const control = this.changePasswordForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    this.isChangePasswordLoading = true;
    this.changePasswordError = '';
    this.changePasswordSuccess = '';
    
    const changeData: ChangePasswordRequest = {
      userId: this.userProfile?.id as number,
      currentPassword: this.changePasswordForm.get('currentPassword')?.value,
      newPassword: this.changePasswordForm.get('newPassword')?.value
    };
    
    this.authService.changePassword(changeData).subscribe({
      next: (response) => {
        this.isChangePasswordLoading = false;
        this.changePasswordSuccess = response.message || 'Password has been changed successfully';
        
        // Reset form and close modal after a delay
        setTimeout(() => {
          this.showChangePasswordModal = false;
          this.changePasswordForm.reset();
          this.successMessage = 'Password changed successfully.';
        }, 2000);
      },
      error: (error) => {
        this.isChangePasswordLoading = false;
        this.changePasswordError = error.message || 'Failed to change password';
      }
    });
  }
}
