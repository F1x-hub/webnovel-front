import { Component, OnInit } from '@angular/core';
import { Novel } from '../../components/novel-card/novel-card.component';
import { NovelService } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';

interface WeeklyBook extends Novel {
  author: string;
  description: string;
  rank?: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  weeklyBooks: Novel[] = [];
  topRankedNovels: Novel[] = [];
  loading = false;
  loadingRanked = false;

  constructor(
    private novelService: NovelService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadWeeklyPopularBooks();
    this.loadTopRankedNovels();
  }

  loadWeeklyPopularBooks(): void {
    this.loading = true;
    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    
    this.novelService.getMostPopularLastWeek(10, userId)
      .subscribe({
        next: (data) => {
          console.log('Weekly popular books data:', data);
          if (Array.isArray(data)) {
          this.weeklyBooks = data.map(novel => {
            if (novel.id) {
              novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            }
            return novel;
          });
          } else {
            console.error('Unexpected response format:', data);
            this.weeklyBooks = [];
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load weekly popular books:', err);
          this.loading = false;
        }
      });
  }

  loadTopRankedNovels(): void {
    this.loadingRanked = true;
    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    
    this.novelService.getNovelsByRating(10, userId)
      .subscribe({
        next: (data) => {
          console.log('Top ranked novels data:', data);
          if (Array.isArray(data)) {
          this.topRankedNovels = data.map(novel => {
            if (novel.id) {
              novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            }
            return novel;
          });
          } else {
            console.error('Unexpected response format:', data);
            this.topRankedNovels = [];
          }
          this.loadingRanked = false;
        },
        error: (err) => {
          console.error('Failed to load ranked novels:', err);
          this.loadingRanked = false;
        }
      });
  }
}
