import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet]
})
export class AdminLayoutComponent implements OnInit {
  isAdmin: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const user = this.authService.currentUserValue;
    this.isAdmin = user?.roleId === 2;
    
    if (!this.isAdmin) {
      this.router.navigate(['/']);
    }
  }
} 