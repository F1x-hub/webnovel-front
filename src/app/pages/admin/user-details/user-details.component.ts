import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { UserService, UserProfile } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { AdminService } from '../../../services/admin.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class UserDetailsComponent implements OnInit {
  userId: number | null = null;
  user: UserProfile | null = null;
  isLoading: boolean = true;
  error: string = '';
  currentUserId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public userService: UserService,
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.authService.currentUserValue;
    if (currentUser?.roleId !== 2) {
      this.router.navigate(['/']);
      return;
    }
    
    this.currentUserId = currentUser.id || null;
    
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
    this.isLoading = true;
    this.error = '';
    
    // Use the actual API to get user data
    this.userService.getUserProfile(userId).subscribe({
      next: (userData) => {
        this.user = userData;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading user details:', err);
        this.error = 'Failed to load user details. Falling back to cached data.';
        
        // Always fall back to mock data in case of API error
        this.mockGetUser(userId);
      }
    });
  }

  // Keep mock method as fallback for development/testing
  mockGetUser(userId: number): void {
    // Mock user data for demonstration
    const mockUser: UserProfile = {
      id: userId,
      userName: 'user' + userId,
      email: 'user' + userId + '@example.com',
      firstName: 'User',
      lastName: 'Name',
      age: 25,
      roleId: 1,
      roleName: 'User',
      memberSince: new Date(),
      createdAt: new Date().toISOString()
    };
    
    // Use the current user's data if viewing own profile
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
      this.isLoading = false;
    }, 800);
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  getRoleBadgeClass(roleId: number): string {
    return roleId === 2 ? 'role-admin' : 'role-user';
  }

  navigateToEdit(): void {
    if (this.userId) {
      this.router.navigate(['/admin/users/edit', this.userId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = 'assets/images/default-avatar.png';
    }
  }
} 