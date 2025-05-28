import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(): boolean {
    const user = this.authService.currentUserValue;
    
    // Check if user is logged in and has admin role (roleId = 2)
    if (user && user.roleId === 2) {
      return true;
    }
    
    // If not admin, redirect to home page
    this.router.navigate(['/']);
    return false;
  }
} 