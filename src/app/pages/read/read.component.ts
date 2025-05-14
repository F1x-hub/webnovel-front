import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NovelService, GetChapterDto } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { LibraryService, ToggleReadResponse } from '../../services/library.service';
import { Location } from '@angular/common';
import { AgeVerificationService } from '../../services/age-verification.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-read',
  templateUrl: './read.component.html',
  styleUrls: ['./read.component.css']
})
export class ReadComponent implements OnInit {
  novelId: number = 0;
  novelTitle: string = '';
  chapterNumber: number = 1;
  chapter: GetChapterDto | null = null;
  loading: boolean = true;
  error: boolean = false;
  errorMessage: string = '';
  totalChapters: number = 0;
  isLastReadChapter: boolean = false;
  lastReadChapter: number = 0;
  showMarkReadNotification: boolean = false;
  private previousUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private novelService: NovelService,
    public authService: AuthService,
    private libraryService: LibraryService,
    private location: Location,
    private ageVerificationService: AgeVerificationService,
    private sanitizer: DomSanitizer
  ) {
    // Пытаемся получить предыдущий URL из истории состояния
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.previousUrl = navigation.extras.state['prevUrl'] as string;
      console.log('Previous URL from state:', this.previousUrl);
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.novelId = +params['id'];
        
        // Get chapter number from route, default to 1 if not provided
        this.chapterNumber = params['chapterNumber'] ? +params['chapterNumber'] : 1;
        
        // Load novel details to get the title
        this.loadNovelDetails();
        
        // Get all chapters to determine total count
        this.fetchChapterCount();
        this.loadChapter();
        this.checkIfLastReadChapter();
      } else {
        this.error = true;
        this.loading = false;
        this.errorMessage = 'Novel ID is required';
      }
    });
  }

  loadNovelDetails(): void {
    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    
    this.novelService.getNovelById(this.novelId, userId).subscribe({
      next: (novel) => {
        this.novelTitle = novel.title;
        
        // Check if this is adult content and user should see it
        if (novel.isAdultContent && !this.ageVerificationService.checkContentAccess(true)) {
          // Show age verification modal if content is restricted
          this.ageVerificationService.showVerificationModal(this.novelId);
        }
      },
      error: (err) => {
        console.error('Error loading novel details:', err);
        // Не устанавливаем error=true, чтобы не блокировать загрузку главы
        // если не удалось загрузить детали новеллы
      }
    });
  }

  fetchChapterCount(): void {
    this.novelService.getAllChapters(this.novelId).subscribe({
      next: (chapters) => {
        this.totalChapters = chapters.length;
      },
      error: (err) => {
        console.error('Error fetching chapter count:', err);
        this.totalChapters = 0;
      }
    });
  }

  loadChapter(): void {
    const userId = this.authService.currentUserValue?.id || 0;
    
    this.loading = true;
    this.error = false;
    
    this.novelService.getChapterByNumber(this.novelId, this.chapterNumber, userId)
      .subscribe({
        next: (chapter) => {
          this.chapter = chapter;
          this.loading = false;
          
          // Update URL to reflect current chapter
          this.updateUrl();
          
          // Check if this is the last read chapter after loading chapter
          this.checkIfLastReadChapter();
        },
        error: (err) => {
          console.error('Error loading chapter:', err);
          this.error = true;
          this.loading = false;
          this.errorMessage = err.error || 'Failed to load chapter';
        }
      });
  }

  checkIfLastReadChapter(): void {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser?.id || !this.novelId || !this.chapterNumber) {
      this.isLastReadChapter = false;
      return;
    }
    
    this.libraryService.isCurrentReadChapter(currentUser.id, this.novelId, this.chapterNumber).subscribe({
      next: (isCurrentChapter) => {
        this.isLastReadChapter = isCurrentChapter;
        
        // If this is already the last read chapter, we may need to mark UI elements
        setTimeout(() => {
          // Force change detection after component is rendered
          const markReadButtons = document.querySelectorAll('.mark-read-btn');
          if (this.isLastReadChapter && markReadButtons) {
            markReadButtons.forEach(btn => {
              if (!btn.classList.contains('active')) {
                btn.classList.add('active');
              }
            });
          }
        }, 100);
      },
      error: (err) => {
        console.error('Error checking last read chapter:', err);
        this.isLastReadChapter = false;
      }
    });
  }

  markAsLastRead(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser?.id && this.novelId && this.chapterNumber) {
      const userId = currentUser.id;
      const novelId = this.novelId;
      const chapterNumber = this.chapterNumber;
      
      // Immediately toggle UI state for instant feedback
      this.isLastReadChapter = !this.isLastReadChapter;
      
      this.libraryService.toggleLastReadChapter(userId, novelId, chapterNumber).subscribe({
        next: (response: ToggleReadResponse) => {
          console.log('Toggle response:', response);
          // Update with actual server response - use isMarked property
          this.isLastReadChapter = response.isMarked;
          
          // If marked as last read, update the lastReadChapter property
          if (response.isMarked) {
            this.lastReadChapter = chapterNumber;
          } else {
            this.lastReadChapter = response.lastReadChapter || 0;
          }
          
          // Force update UI elements
          setTimeout(() => {
            const markReadButtons = document.querySelectorAll('.mark-read-btn');
            markReadButtons.forEach(btn => {
              if (this.isLastReadChapter) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
          }, 0);
          
          // Show notification
          this.showMarkReadNotification = true;
          // Hide notification after 3 seconds
          setTimeout(() => {
            this.showMarkReadNotification = false;
          }, 3000);
        },
        error: (err: any) => {
          console.error('Error toggling last read chapter:', err);
          // Revert UI state on error
          this.isLastReadChapter = !this.isLastReadChapter;
        }
      });
    }
  }

  nextChapter(): void {
    if (this.chapterNumber < this.totalChapters) {
      this.chapterNumber++;
      this.loadChapter();
    }
  }

  previousChapter(): void {
    if (this.chapterNumber > 1) {
      this.chapterNumber--;
      this.loadChapter();
    }
  }

  hasNextChapter(): boolean {
    return this.chapterNumber < this.totalChapters;
  }

  hasPreviousChapter(): boolean {
    return this.chapterNumber > 1;
  }

  updateUrl(): void {
    this.router.navigate(['/read', this.novelId, this.chapterNumber], { 
      replaceUrl: true,
      skipLocationChange: false
    });
  }

  goBack(): void {
    if (this.previousUrl) {
      // Если у нас есть предыдущий URL, используем его
      this.router.navigateByUrl(this.previousUrl);
    } else {
      // Иначе возвращаемся на страницу новеллы
      this.router.navigate(['/novel', this.novelId]);
    }
  }

  fetchNovelData(): void {
    if (!this.novelId) return;
    
    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    
    this.novelService.getNovelById(this.novelId, userId).subscribe({
      next: (novel) => {
        this.novelTitle = novel.title;
        this.fetchChapterCount();
        this.loadChapter();
      },
      error: (err) => {
        console.error('Error fetching novel information:', err);
        this.loading = false;
        this.error = true;
        this.errorMessage = 'Failed to load the novel. Please try again.';
      }
    });
  }
}
