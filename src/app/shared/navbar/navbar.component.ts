import { Component, OnInit, HostListener, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isDarkMode: boolean = true;
  isLoggedIn: boolean = false;
  userName: string = '';
  userFirstName: string = '';
  userEmail: string = '';
  userId: number | null = null;
  userRoleId: number | null = null;
  isUserMenuOpen: boolean = false;
  cachedProfileImage: string | null = null;
  private subscriptions: Subscription[] = [];
  
  // Search modal
  isSearchModalOpen: boolean = false;
  
  // New chapters notification
  hasNewChapters: boolean = false;

  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {
    const themeSub = this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    this.subscriptions.push(themeSub);
  }

  ngOnInit(): void {
    // Subscribe to auth changes
    const authSub = this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.userName = user?.userName || '';
      this.userFirstName = user?.firstName || '';
      this.userEmail = user?.email || '';
      this.userId = user?.id || null;
      this.userRoleId = user?.roleId || null;
      this.hasNewChapters = user?.hasNewChapters || false;
      
      console.log('Auth state updated');
      
      // Load cached profile image when user ID changes
      if (this.userId) {
        this.loadCachedProfileImage(this.userId);
        
        // If userId is available but roleId is null, fetch user data directly
        if (this.userRoleId === null) {
          this.fetchUserDirectly(this.userId);
        }
      } else {
        // Clear cached image if user logs out
        this.cachedProfileImage = null;
      }
    });
    this.subscriptions.push(authSub);
    
    // Force refresh user data on init
    if (this.isLoggedIn && this.userId) {
      this.refreshUserData();
    }
    
    // Load user data from localStorage on init
    this.loadUserDataFromLocalStorage();
  }
  
  /**
   * Load user data directly from localStorage
   */
  private loadUserDataFromLocalStorage(): void {
    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('User data loaded from storage');
        
        // Update user data
        this.isLoggedIn = !!user;
        this.userName = user?.userName || this.userName;
        this.userFirstName = user?.firstName || this.userFirstName;
        this.userEmail = user?.email || this.userEmail;
        this.userId = user?.id || this.userId;
        this.userRoleId = user?.roleId || this.userRoleId;
        
        // If we have a userId but no roleId, fetch user data
        if (this.userId && this.userRoleId === null) {
          this.fetchUserDirectly(this.userId);
        }
      }
    } catch (error) {
      console.error('Error parsing user data from localStorage');
    }
  }
  
  /**
   * Fetch user data directly from the API
   */
  private fetchUserDirectly(userId: number): void {
    console.log('Fetching user data directly');
    this.userService.getUserProfile(userId).subscribe({
      next: (user) => {
        console.log('User data fetched successfully');
        // Update local properties
        this.userRoleId = user.roleId;
        
        // Update stored user data
        this.authService.updateStoredUserData({
          id: user.id,
          userName: user.userName,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          roleName: user.roleId === 2 ? 'Admin' : 'User'
        });
      },
      error: (err) => {
        console.error('Error fetching user data');
      }
    });
  }
  
  refreshUserData(): void {
    if (!this.userId) return;
    
    const refreshSub = this.authService.getCurrentUserById().subscribe({
      next: (userData) => {
        console.log('User data refreshed successfully');
        // Update hasNewChapters from fresh user data
        this.hasNewChapters = userData?.hasNewChapters || false;
        
        // Make sure roleId is updated
        if (userData && userData.roleId) {
          this.userRoleId = userData.roleId;
        }
      },
      error: (err) => {
        console.error('Error refreshing user data');
      }
    });
    this.subscriptions.push(refreshSub);
  }
  
  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadCachedProfileImage(userId: number): void {
    const imageSub = this.userService.getProfileImageWithCache(userId).subscribe({
      next: (imageData) => {
        this.cachedProfileImage = imageData;
      },
      error: (error) => {
        console.error('Error loading cached profile image in navbar:', error);
        this.cachedProfileImage = null;
      }
    });
    this.subscriptions.push(imageSub);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // Search modal methods
  openSearchModal(): void {
    this.isSearchModalOpen = true;
    // Prevent scroll on the body when modal is open
    document.body.style.overflow = 'hidden';
  }
  
  closeSearchModal(): void {
    this.isSearchModalOpen = false;
    // Restore scroll on the body when modal is closed
    document.body.style.overflow = '';
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    // Log the user role information without sensitive data
    console.log('User menu toggled');
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  navigateToProfile(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/profile']);
  }
  
  navigateToAdmin(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/admin']);
  }

  isAdmin(): boolean {
    // Don't log sensitive information
    return this.userRoleId === 2;
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  getProfileImageUrl(): string {
    // If we have a cached image, use it
    if (this.cachedProfileImage) {
      return this.cachedProfileImage;
    }
    
    // Fallback to regular URL
    if (this.userId) {
      return this.userService.getProfileImageUrl(this.userId);
    }
    
    return 'assets/images/default-avatar.png';
  }

  @HostListener('document:click')
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  // Check for library updates
  checkForLibraryUpdates(): void {
    if (this.hasNewChapters) {
      // Clear the notification when the user visits the library
      this.router.navigate(['/library']);
    } else {
      this.router.navigate(['/library']);
    }
  }
}
