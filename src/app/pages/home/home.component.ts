import { Component, OnInit } from '@angular/core';
import { Novel } from '../../components/novel-card/novel-card.component';
import { NovelService } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';

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
    private authService: AuthService,
    private libraryService: LibraryService
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
          if (Array.isArray(data)) {
            this.weeklyBooks = data.map(novel => {
              if (novel.id) {
                novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
              }
              return novel;
            });
            
            // Проверить прогресс чтения, если пользователь авторизован
            if (userId && this.weeklyBooks.length > 0) {
              this.checkLastReadChapters(userId);
            }
          } else {
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
          if (Array.isArray(data)) {
            this.topRankedNovels = data.map(novel => {
              if (novel.id) {
                novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
              }
              return novel;
            });
            
            // Проверить прогресс чтения, если пользователь авторизован
            if (userId && this.topRankedNovels.length > 0) {
              this.checkLastReadChaptersForRanked(userId);
            }
          } else {
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
  
  checkLastReadChapters(userId: number): void {
    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        if (!libraryEntries || libraryEntries.length === 0) return;
        
        // Update reading progress info for weekly books
        this.weeklyBooks.forEach(novel => {
          if (novel.id) {
            const entry = libraryEntries.find(lib => lib.novelId === novel.id);
            if (entry) {
              let lastChapter = null;
              
              // Check object structure (C# uses PascalCase, JS uses camelCase)
              if (entry.LastReadChapter !== undefined) {
                lastChapter = entry.LastReadChapter;
              } else if (entry.lastReadChapter !== undefined) {
                lastChapter = entry.lastReadChapter;
              }
              
              // Only set if it's a valid chapter number
              if (lastChapter !== null && lastChapter > 0) {
                novel.currentChapter = lastChapter;
              }
            }
          }
        });
      },
      error: (err) => {
        console.error('Error checking last read chapters for weekly books:', err);
      }
    });
  }
  
  checkLastReadChaptersForRanked(userId: number): void {
    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        if (!libraryEntries || libraryEntries.length === 0) return;
        
        // Update reading progress info for ranked novels
        this.topRankedNovels.forEach(novel => {
          if (novel.id) {
            const entry = libraryEntries.find(lib => lib.novelId === novel.id);
            if (entry) {
              let lastChapter = null;
              
              // Check object structure (C# uses PascalCase, JS uses camelCase)
              if (entry.LastReadChapter !== undefined) {
                lastChapter = entry.LastReadChapter;
              } else if (entry.lastReadChapter !== undefined) {
                lastChapter = entry.lastReadChapter;
              }
              
              // Only set if it's a valid chapter number
              if (lastChapter !== null && lastChapter > 0) {
                novel.currentChapter = lastChapter;
              }
            }
          }
        });
      },
      error: (err) => {
        console.error('Error checking last read chapters for ranked novels:', err);
      }
    });
  }
}
