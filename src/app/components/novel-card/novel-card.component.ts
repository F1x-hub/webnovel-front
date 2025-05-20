import { Component, Input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { LibraryService } from '../../services/library.service';
import { AuthService } from '../../services/auth.service';

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
}

@Component({
  selector: 'app-novel-card',
  templateUrl: './novel-card.component.html',
  styleUrls: ['./novel-card.component.css']
})
export class NovelCardComponent implements OnInit {
  @Input() novel: Novel = {
    title: '',
    genre: ''
  };
  @Input() showProgress: boolean = true;
  imageLoaded: boolean = false;
  isLibraryPage: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private libraryService: LibraryService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Определяем, находимся ли мы на странице библиотеки
    this.isLibraryPage = this.router.url.includes('/library');
    
    // Если у нас нет информации о текущей главе, но есть id новеллы, 
    // и пользователь авторизован - запросим данные из библиотеки
    if (!this.novel.currentChapter && this.novel.id && this.authService.isLoggedIn) {
      this.checkLastReadChapter();
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
    // Это гарантирует, что браузер правильно обработает "назад"
    const currentUrl = this.location.path();
    
    // Всегда переходим на детальную страницу новеллы, даже если есть сохраненный прогресс чтения
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
}
