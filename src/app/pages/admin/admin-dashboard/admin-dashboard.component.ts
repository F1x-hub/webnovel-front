import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { NovelService } from '../../../services/novel.service';
import { GenreService } from '../../../services/genre.service';
import { AdminService, UserStats } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class AdminDashboardComponent implements OnInit {
  totalUsers: number = 0;
  adminUsers: number = 0;
  totalNovels: number = 0;
  totalGenres: number = 0;
  isLoading: boolean = true;
  error: string = '';
  adminName: string = '';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private novelService: NovelService,
    private genreService: GenreService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    // Check if user is admin
    const user = this.authService.currentUserValue;
    if (user?.roleId !== 2) {
      return;
    }
    
    this.adminName = user.firstName || user.userName;
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    
    // Get user statistics
    this.adminService.getUserStats().subscribe({
      next: (stats: UserStats) => {
        this.totalUsers = stats.totalUsers;
        this.adminUsers = stats.adminUsers;
        this.fetchNovelCount();
      },
      error: (err: any) => {
        console.error('Error fetching user stats:', err);
        this.error = 'Failed to load dashboard data';
        this.isLoading = false;
      }
    });
  }

  fetchNovelCount(): void {
    // Fetch novels with a page size of 1 just to get the total count
    this.novelService.getNovels({ pageSize: 1 }).subscribe({
      next: (response) => {
        this.totalNovels = response.totalItems;
        this.fetchGenreCount();
      },
      error: (err: any) => {
        console.error('Error fetching novel count:', err);
        this.error = 'Failed to load dashboard data';
        this.isLoading = false;
        this.fetchGenreCount(); // Still try to fetch genre count
      }
    });
  }

  fetchGenreCount(): void {
    // Fetch all genres to get the count
    this.genreService.getAllGenres().subscribe({
      next: (genres) => {
        this.totalGenres = genres.length;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error fetching genre count:', err);
        this.error = 'Failed to load complete dashboard data';
        this.isLoading = false;
      }
    });
  }
} 