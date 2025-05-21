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
    const authSub = this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.userName = user?.userName || '';
      this.userFirstName = user?.firstName || '';
      this.userEmail = user?.email || '';
      this.userId = user?.id || null;
      this.hasNewChapters = user?.hasNewChapters || false;
      
      // Load cached profile image when user ID changes
      if (this.userId) {
        this.loadCachedProfileImage(this.userId);
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
  }
  
  refreshUserData(): void {
    if (!this.userId) return;
    
    const refreshSub = this.authService.getCurrentUserById().subscribe({
      next: (userData) => {
        console.log('User data refreshed successfully');
        // Update hasNewChapters from fresh user data
        this.hasNewChapters = userData?.hasNewChapters || false;
      },
      error: (err) => {
        console.error('Error refreshing user data:', err);
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
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  navigateToProfile(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/profile']);
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
