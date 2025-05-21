import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

export enum NovelStatus {
  InProgress = 1,
  Frozen = 2,
  Abandoned = 3,
  Completed = 4
}

export interface Novel {
  id?: number;
  title: string;
  genre: string;
  genres?: string[];
  imageUrl?: string;
  rating?: number;
  ratingsCount?: number;
  currentChapter?: number;
  totalChapters?: number;
  author?: string;
  description?: string;
  userId?: number;
  views?: number;
  status?: NovelStatus;
  isAdultContent?: boolean;
  addedChapter?: boolean;
}

@Component({
  selector: 'app-novel-card',
  templateUrl: './novel-card.component.html',
  styleUrls: ['./novel-card.component.css']
})
export class NovelCardComponent implements OnInit, OnDestroy {
  @Input() novel: Novel = {
    title: '',
    genre: ''
  };
  @Input() showProgress: boolean = true;
  imageLoaded: boolean = false;
  isLibraryPage: boolean = false;
  private routerSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private libraryService: LibraryService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Set initial value based on current URL
    this.isLibraryPage = this.router.url.includes('/library');
    
    // Subscribe to router events to update isLibraryPage when navigation occurs
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isLibraryPage = this.router.url.includes('/library');
    });
    
    // If we don't have current chapter info but have novel id and user is logged in
    if (!this.novel.currentChapter && this.novel.id && this.authService.isLoggedIn) {
      this.checkLastReadChapter();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscription when component is destroyed
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  checkLastReadChapter(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.novel.id) return;

    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        const novelEntry = libraryEntries.find(entry => entry.novelId === this.novel.id);
        
        if (novelEntry) {
          let chapter = null;
          
          // Check object structure (C# uses PascalCase, JS uses camelCase)
          if (novelEntry.LastReadChapter !== undefined) {
            chapter = novelEntry.LastReadChapter;
          } else if (novelEntry.lastReadChapter !== undefined) {
            chapter = novelEntry.lastReadChapter;
          }
          
          // Only set if it's a valid chapter number
          if (chapter !== null && chapter > 0) {
            this.novel.currentChapter = chapter;
          }
        }
      },
      error: (err) => {
        console.error('Error checking last read chapter:', err);
      }
    });
  }

  navigateToNovel(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.novel.id) return;

    // Сохраняем текущий URL перед навигацией
    const currentUrl = this.location.path();
    
    // Если есть индикатор новой главы, сбрасываем его в фоновом режиме
    if (this.novel.addedChapter && this.novel.id) {
      const userId = this.authService.currentUserValue?.id;
      if (userId) {
        // Запускаем запрос на сброс в фоновом режиме
        this.libraryService.resetAddedChapter(userId, this.novel.id).subscribe({
          next: () => {
            console.log('Successfully reset added chapter status');
            this.novel.addedChapter = false;
          },
          error: (err) => {
            console.error('Error resetting added chapter status:', err);
          }
        });
      }
    }
    
    // Выполняем навигацию немедленно, не дожидаясь завершения запроса выше
    
    // In the library page, navigate directly to the last read chapter
    if (this.isLibraryPage && this.novel.currentChapter && this.novel.currentChapter > 0) {
      this.router.navigate(['/read', this.novel.id, this.novel.currentChapter]);
      return;
    }
    
    // Otherwise go to the novel detail page
    this.router.navigate(['/novel', this.novel.id], { 
      state: { prevUrl: currentUrl }
    });
  }

  onImageError(event: Event): void {
    // When the image fails to load, set default cover
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/default-cover.png';
      this.imageLoaded = true;
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
  }
  
  getProgressPercentage(): string {
    if (!this.novel.currentChapter || !this.novel.totalChapters || this.novel.totalChapters === 0) {
      return '0%';
    }
    
    const percentage = Math.min(100, Math.round((this.novel.currentChapter / this.novel.totalChapters) * 100));
    return `${percentage}%`;
  }
}
