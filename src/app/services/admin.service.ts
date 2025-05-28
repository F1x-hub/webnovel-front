import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserProfile } from './user.service';
import { AuthService } from './auth.service';

export interface UserStats {
  totalUsers: number;
  adminUsers: number;
}

export interface User extends UserProfile {
  // Additional admin-specific user properties can be added here
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Get all users from the API
   */
  getAllUsers(): Observable<User[]> {
    // Use the actual API endpoint - auth will be added by interceptor
    return this.http.get<User[]>(`${this.apiUrl}/api/User/get-all-user`)
      .pipe(
        catchError(error => {
          console.error('Error fetching users:', error);
          // Fall back to mock data if the API call fails
          return of(this.getMockUsers());
        })
      );
  }

  /**
   * Get user statistics
   */
  getUserStats(): Observable<UserStats> {
    // First try to get real data
    return this.getAllUsers().pipe(
      catchError(error => {
        console.error('Error getting user stats:', error);
        return of(this.getMockUsers());
      }),
      map(users => ({
        totalUsers: users.length,
        adminUsers: users.filter(user => user.roleId === 2).length
      }))
    );
  }

  /**
   * Delete a user with the API
   */
  deleteUser(userId: number): Observable<any> {
    // Use the actual API endpoint - auth will be added by interceptor
    return this.http.delete(`${this.apiUrl}/api/User/delete/${userId}`)
      .pipe(
        catchError(error => {
          console.error('Error deleting user:', error);
          return of({ success: false, message: 'Failed to delete user' });
        })
      );
  }

  /**
   * Update a user with the API
   */
  updateUser(userId: number, userData: Partial<User>): Observable<any> {
    // Format data according to API expectations (first letter capitalized)
    const formattedData = {
      UserName: userData.userName,
      Email: userData.email,
      FirstName: userData.firstName,
      LastName: userData.lastName,
      RoleId: userData.roleId,
      Age: userData.age || 0
    };

    // Use the actual API endpoint - auth will be added by interceptor
    return this.http.put(`${this.apiUrl}/api/User/update/${userId}`, formattedData, {
      responseType: 'text' as 'json'
    }).pipe(
      catchError(error => {
        console.error('Error updating user:', error);
        return of({ success: false, message: 'Failed to update user' });
      })
    );
  }

  /**
   * Creates mock user data for demonstration purposes
   */
  private getMockUsers(): User[] {
    return [
      {
        id: 1,
        userName: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        age: 30,
        roleId: 2,
        roleName: 'Admin',
        memberSince: new Date('2023-01-01')
      },
      {
        id: 2,
        userName: 'user1',
        email: 'user1@example.com',
        firstName: 'Regular',
        lastName: 'User',
        age: 25,
        roleId: 1,
        roleName: 'User',
        memberSince: new Date('2023-02-15')
      },
      {
        id: 3,
        userName: 'user2',
        email: 'user2@example.com',
        firstName: 'John',
        lastName: 'Doe',
        age: 28,
        roleId: 1,
        roleName: 'User',
        memberSince: new Date('2023-03-20')
      }
    ];
  }
} 