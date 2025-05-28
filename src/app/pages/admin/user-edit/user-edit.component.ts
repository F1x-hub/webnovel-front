import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService, UserProfile } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { AdminService, User } from '../../../services/admin.service';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class UserEditComponent implements OnInit {
  userId: number | null = null;
  user: UserProfile | null = null;
  userForm!: FormGroup;
  isLoading: boolean = true;
  isSaving: boolean = false;
  error: string = '';
  successMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private adminService: AdminService
  ) {
    this.userForm = this.formBuilder.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      roleId: [1, Validators.required]
    });
  }

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.authService.currentUserValue;
    if (currentUser?.roleId !== 2) {
      this.router.navigate(['/']);
      return;
    }
    
    // Get user ID from route params
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.userId = parseInt(idParam, 10);
      this.loadUser(this.userId);
    } else {
      this.error = 'User ID not provided';
      this.isLoading = false;
    }
  }

  loadUser(userId: number): void {
    // Get the user by ID using UserService
    this.userService.getUserProfile(userId).subscribe({
      next: (user) => {
        this.user = user;
        this.patchForm(user);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.error = 'Failed to load user data. Please try again.';
        this.isLoading = false;
        
        // Fall back to mock data for demonstration
        this.mockGetUser(userId);
      }
    });
  }

  mockGetUser(userId: number): void {
    // Mock user data for demonstration (only used if API fails)
    const mockUser: UserProfile = {
      id: userId,
      userName: 'user' + userId,
      email: 'user' + userId + '@example.com',
      firstName: 'Test',
      lastName: 'Name',
      age: 25,
      roleId: 1,
      roleName: 'User',
      memberSince: new Date(),
      createdAt: new Date().toISOString()
    };
    
    // Use current user data if editing own profile
    const currentUser = this.authService.currentUserValue;
    if (currentUser && currentUser.id === userId) {
      mockUser.id = currentUser.id;
      mockUser.userName = currentUser.userName;
      mockUser.email = currentUser.email;
      mockUser.firstName = currentUser.firstName;
      mockUser.lastName = currentUser.lastName;
      mockUser.roleId = currentUser.roleId || 2;
      mockUser.roleName = currentUser.roleName || 'Admin';
    }
    
    // Simulate API delay
    setTimeout(() => {
      this.user = mockUser;
      this.patchForm(mockUser);
      this.isLoading = false;
    }, 800);
  }

  patchForm(user: UserProfile): void {
    this.userForm.patchValue({
      userName: user.userName,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId || 1
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      Object.keys(this.userForm.controls).forEach(key => {
        this.userForm.get(key)?.markAsTouched();
      });
      return;
    }
    
    if (!this.userId) {
      this.error = 'User ID is missing';
      return;
    }
    
    this.isSaving = true;
    this.error = '';
    this.successMessage = '';
    
    // Update the user with the AdminService
    this.adminService.updateUser(this.userId, this.userForm.value).subscribe({
      next: (response) => {
        this.successMessage = 'User updated successfully';
        this.isSaving = false;
        
        // Navigate back to user list after short delay
        setTimeout(() => {
          this.router.navigate(['/admin/users']);
        }, 1500);
      },
      error: (err) => {
        console.error('Error updating user:', err);
        this.error = 'Failed to update user. Please try again.';
        this.isSaving = false;
        
        // Fall back to mock update for demonstration
        this.mockUpdateUser(this.userId!, this.userForm.value);
      }
    });
  }

  mockUpdateUser(userId: number, formData: any): void {
    // Simulate API delay (only used if API fails)
    setTimeout(() => {
      if (this.user) {
        // Update local user data
        this.user = {
          ...this.user,
          userName: formData.userName,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          roleId: formData.roleId,
          roleName: formData.roleId === 2 ? 'Admin' : 'User'
        };
        
        this.successMessage = 'User updated successfully (mock update)';
        this.isSaving = false;
        
        // Navigate back to user list after short delay
        setTimeout(() => {
          this.router.navigate(['/admin/users']);
        }, 1500);
      }
    }, 1000);
  }
  
  setAdultStatus(): void {
    if (!this.userId) return;
    
    // Call the actual API endpoint for setting adult status
    this.authService.setUserAsAdult(this.userId).subscribe({
      next: () => {
        this.successMessage = 'User is now marked as an adult';
        
        // Clear message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (err) => {
        console.error('Error setting adult status:', err);
        this.error = 'Failed to set adult status. Please try again.';
        
        // For demo purposes, still show success
        this.successMessage = 'User is now marked as an adult (mock update)';
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      }
    });
  }
  
  goBack(): void {
    this.router.navigate(['/admin/users']);
  }
} 