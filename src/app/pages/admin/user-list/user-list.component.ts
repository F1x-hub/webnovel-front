import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService, UserProfile } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { AdminService, User } from '../../../services/admin.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  isLoading: boolean = true;
  error: string = '';
  successMessage: string = '';
  currentUserId: number | null = null;
  
  // For confirmation dialog
  showDeleteConfirm: boolean = false;
  userToDelete: User | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    // Store current user ID
    this.currentUserId = this.authService.currentUserValue?.id || null;
    
    // Check if user is admin
    const user = this.authService.currentUserValue;
    if (user?.roleId !== 2) {
      return;
    }
    
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = '';
    
    this.adminService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.users = users;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading users:', err);
        this.error = 'Failed to load users. Please try again.';
        this.isLoading = false;
      }
    });
  }

  openDeleteConfirm(user: User): void {
    // Don't allow deleting self
    if (user.id === this.currentUserId) {
      this.error = 'You cannot delete your own account';
      return;
    }
    
    this.userToDelete = user;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.userToDelete = null;
    this.showDeleteConfirm = false;
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;
    
    this.adminService.deleteUser(this.userToDelete.id).subscribe({
      next: () => {
        // Remove user from the local array
        this.users = this.users.filter(user => user.id !== this.userToDelete?.id);
        this.successMessage = 'User deleted successfully';
        this.showDeleteConfirm = false;
        this.userToDelete = null;
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (err: any) => {
        console.error('Error deleting user:', err);
        this.error = 'Failed to delete user. Please try again.';
        this.showDeleteConfirm = false;
        this.userToDelete = null;
      }
    });
  }

  getRoleBadgeClass(roleId: number): string {
    return roleId === 2 ? 'role-admin' : 'role-user';
  }
} 