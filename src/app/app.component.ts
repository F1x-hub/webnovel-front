import { Component, OnInit, OnDestroy } from '@angular/core';
import { ConnectionErrorService } from './services/connection-error.service';
import { TestErrorService } from './services/test-error.service';
import { CommentService } from './services/comment.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'WebNovel';

  constructor(
    private connectionErrorService: ConnectionErrorService,
    private testErrorService: TestErrorService,
    private commentService: CommentService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Initialize the connection error service
    // The VpnErrorModalComponent will subscribe to the service events
    
    // Check and fix user data to ensure roleId is properly set
    AuthService.checkAndFixUserData();
    
    // Refresh user data if user is logged in
    if (this.authService.isLoggedIn) {
      console.log('User is logged in, ensuring data is up to date');
      
      // First try to get current user from localStorage
      const user = this.authService.currentUserValue;
      if (user && user.id) {
        console.log('User ID found:', user.id);
        
        // Verify token exists
        if (user.token) {
          console.log('User token exists');
        } else {
          console.warn('User token missing');
        }
        
        // Log role information
        console.log('User roleId:', user.roleId);
        console.log('User roleName:', user.roleName);
        
        // Directly fetch user data from API to ensure we have the correct roleId
        this.userService.getUserProfile(user.id).subscribe({
          next: (userData) => {
            console.log('User data refreshed on app start');
            console.log('API returned roleId:', userData.roleId);
            
            // Update stored user data with fresh data including roleId
            this.authService.updateStoredUserData({
              ...userData,
              // Keep the token from the current user
              token: user.token
            });
          },
          error: (err) => {
            console.error('Error refreshing user data on app start:', err);
            // Fall back to refreshUserData if direct fetch fails
            this.authService.refreshUserData().subscribe({
              next: () => console.log('User data refreshed via AuthService'),
              error: (refreshErr) => console.error('Failed to refresh user data:', refreshErr)
            });
          }
        });
      } else {
        console.warn('User logged in but ID missing');
        this.authService.refreshUserData().subscribe({
          next: () => console.log('User data refreshed via AuthService'),
          error: (err) => console.error('Failed to refresh user data:', err)
        });
      }
    } else {
      console.log('User not logged in');
    }
  }
  
  ngOnDestroy(): void {
    // Clean up SignalR connection when app is destroyed
    this.commentService.stopConnection();
  }
}
