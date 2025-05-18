import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NovelService, Chapter } from '../../services/novel.service';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { LibraryService } from '../../services/library.service';
import { CommentService, CreateNovelCommentDto } from '../../services/comment.service';
import { NovelComment } from '../../models/novel-comment.model';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { AgeVerificationService } from '../../services/age-verification.service';

interface Volume {
  name: string;
  chapters: Chapter[];
}

@Component({
  selector: 'app-novel-detail',
  templateUrl: './novel-detail.component.html',
  styleUrls: ['./novel-detail.component.css']
})
export class NovelDetailComponent implements OnInit, OnDestroy {
  novel: Novel | null = null;
  loading = true;
  error = false;
  activeTab = 'about';
  volumes: Volume[] = [];
  latestChapter: Chapter | null = null;
  chapters: Chapter[] = [];
  currentUser: User | null = null;
  author: User | null = null;
  isInLibrary = false;
  libraryLoading = false;
  lastReadChapter: number | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  coverImageLoaded = false;
  // Comments
  comments: NovelComment[] = [];
  commentsLoading = false;
  commentForm: FormGroup;
  commentsSubscription: Subscription | null = null;
  
  // Cache for user avatars
  private userAvatarCache: {[userId: number]: string} = {};
  
  private previousUrl: string | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private novelService: NovelService,
    private authService: AuthService,
    private userService: UserService,
    private libraryService: LibraryService,
    private commentService: CommentService,
    private fb: FormBuilder,
    private location: Location,
    private ageVerificationService: AgeVerificationService
  ) {
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]]
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'assets/images/default-cover.png';
      // Force a re-render by triggering onload
      setTimeout(() => {
        this.coverImageLoaded = true;
      }, 100);
    }
  }

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.chapters = [];
    this.volumes = [];
    this.coverImageLoaded = false;
    
    // Load sort direction from localStorage
    this.loadSortDirection();
    
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.fetchNovel(id);
        this.fetchChapters(id);
        this.loadComments(id);
        
        // Check library status after a slight delay to ensure 
        // authentication is fully initialized
        if (this.currentUser) {
          setTimeout(() => {
            this.checkLibraryStatus(id);
          }, 300);
        }
      } else {
        this.error = true;
        this.loading = false;
      }
    });

    // Listen for auth state changes
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      const novelId = Number(this.route.snapshot.paramMap.get('id'));
      if (user && novelId) {
        this.checkLibraryStatus(novelId);
      } else {
        this.isInLibrary = false;
      }
    });
    
    // Subscribe to novel comments
    this.commentsSubscription = this.commentService.novelComments$.subscribe(comments => {
      this.comments = comments;
    });

    // Пытаемся получить предыдущий URL из истории состояния
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.previousUrl = navigation.extras.state['prevUrl'] as string;
    }
  }
  
  ngOnDestroy(): void {
    if (this.commentsSubscription) {
      this.commentsSubscription.unsubscribe();
    }
  }
  
  loadComments(novelId: number): void {
    this.commentsLoading = true;
    this.commentService.getNovelComments(novelId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.commentsLoading = false;
        
        // Load user avatars for all comments
        this.loadUserAvatars();
        
        // Check if the current user has liked any of the comments
        if (this.currentUser?.id) {
          this.checkUserLikedComments();
        }
      },
      error: (err) => {
        console.error('Error loading comments:', err);
        this.commentsLoading = false;
      }
    });
  }
  
  loadUserAvatars(): void {
    // Process all comments to load avatars
    this.comments.forEach(comment => {
      if (comment.userId && !comment.userAvatar) {
        this.getUserAvatar(comment.userId).then(avatarUrl => {
          comment.userAvatar = avatarUrl;
        });
      }
    });
  }
  
  getUserAvatar(userId: number): Promise<string> {
    // Check cache first
    if (this.userAvatarCache[userId]) {
      return Promise.resolve(this.userAvatarCache[userId]);
    }
    
    // Otherwise get from userService
    return new Promise((resolve) => {
      this.userService.getProfileImageWithCache(userId).subscribe({
        next: (avatarUrl) => {
          this.userAvatarCache[userId] = avatarUrl;
          resolve(avatarUrl);
        },
        error: () => {
          // On error, use default
          const defaultAvatar = 'assets/images/default-avatar.png';
          resolve(defaultAvatar);
        }
      });
    });
  }
  
  checkUserLikedComments(): void {
    if (!this.currentUser?.id) return;
    
    const userId = this.currentUser.id; // Store userId as a constant to help TypeScript
    
    // Check each comment to see if the current user has liked it
    this.comments.forEach(comment => {
      if (comment.id !== undefined) {
        this.commentService.hasUserLikedNovelComment(comment.id, userId).subscribe({
          next: (hasLiked) => {
            comment.isLikedByCurrentUser = hasLiked;
          },
          error: (err) => {
            console.error(`Error checking if user liked comment ${comment.id}:`, err);
          }
        });
      }
    });
  }
  
  submitComment(): void {
    if (!this.commentForm.valid || !this.currentUser?.id || !this.novel?.id) {
      return;
    }
    
    const commentData: CreateNovelCommentDto = {
      displayName: this.currentUser.userName || 'Anonymous',
      content: this.commentForm.value.content,
      publishedDate: new Date().toISOString(),
      likeCount: 0
    };
    
    this.commentService.sendNovelComment(this.currentUser.id, this.novel.id, commentData).subscribe({
      next: (newComment) => {
        // Set the avatar URL for the new comment
        if (newComment && newComment.userId) {
          this.getUserAvatar(newComment.userId).then(avatarUrl => {
            newComment.userAvatar = avatarUrl;
          });
        }
        
        this.commentForm.reset({ content: '' });
      },
      error: (err) => {
        console.error('Error posting comment:', err);
      }
    });
  }
  
  toggleCommentLike(comment: NovelComment): void {
    if (!this.currentUser?.id || comment.id === undefined) return;
    
    this.commentService.toggleNovelCommentLike(comment.id, this.currentUser.id).subscribe({
      next: (likes) => {
        comment.likes = likes;
        comment.isLikedByCurrentUser = !comment.isLikedByCurrentUser;
      },
      error: (err) => {
        console.error('Error toggling like:', err);
      }
    });
  }
  
  deleteComment(comment: NovelComment): void {
    if (!this.currentUser?.id || !this.novel?.id || comment.id === undefined) return;
    
    if (confirm('Are you sure you want to delete this comment?')) {
      this.commentService.deleteNovelComment(comment.id, this.novel.id, this.currentUser.id).subscribe({
        next: () => {
          // Comment will be removed from the list via SignalR
        },
        error: (err) => {
          console.error('Error deleting comment:', err);
        }
      });
    }
  }

  fetchNovel(id: number): void {
    // Reset image loading state
    this.coverImageLoaded = false;
    
    // Get current user ID if logged in
    const userId = this.currentUser?.id || 0;
    
    this.novelService.getNovelById(id, userId).subscribe({
      next: (novel) => {
        this.novel = novel;
        
        // Check if this is adult content and user should see it
        if (novel.isAdultContent && !this.ageVerificationService.checkContentAccess(true)) {
          // Show age verification modal if content is restricted
          this.ageVerificationService.showVerificationModal(id);
        }
        
        // Set the image URL using the service
        if (novel.id) {
          novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
          
          // Get the rating for the novel
          this.novelService.getNovelRating(novel.id).subscribe({
            next: (ratingResponse) => {
              if (this.novel) {
                this.novel.rating = ratingResponse.averageRating;
                this.novel.ratingsCount = ratingResponse.ratingsCount;
              }
            },
            error: (err) => {
              console.error('Error fetching novel rating:', err);
            }
          });
        }
        
        this.loading = false;
        
        if (novel.userId) {
          this.fetchAuthor(novel.userId);
        }

        if (this.currentUser && this.novel?.id) {
          this.checkLastReadChapter(this.currentUser.id as number, this.novel.id as number);
        }
      },
      error: (err) => {
        console.error('Error fetching novel:', err);
        this.error = true;
        this.loading = false;
      }
    });
  }

  fetchAuthor(userId: number): void {
    this.userService.getUserProfile(userId).subscribe({
      next: (user) => {
        this.author = user;
      },
      error: (err) => {
        console.error('Error fetching author:', err);
      }
    });
  }

  fetchChapters(novelId: number): void {
    this.novelService.getAllChapters(novelId).subscribe({
      next: (chapters) => {
        this.chapters = chapters || [];
        this.organizeChapters();
      },
      error: (err) => {
        console.error('Error fetching chapters:', err);
        // Ensure UI shows even if there's an error
        this.chapters = [];
        this.volumes = [];
        this.latestChapter = null;
      }
    });
  }

  organizeChapters(): void {
    if (!this.chapters || this.chapters.length === 0) {
      this.volumes = [];
      this.latestChapter = null;
      return;
    }

    // Sort chapters based on chapter number and current sort direction
    this.chapters.sort((a, b) => {
      if (this.sortDirection === 'asc') {
        return a.chapterNumber - b.chapterNumber;
      } else {
        return b.chapterNumber - a.chapterNumber;
      }
    });

    // Set latest chapter (always the chapter with the highest number)
    const sortedForLatest = [...this.chapters].sort((a, b) => b.chapterNumber - a.chapterNumber);
    this.latestChapter = sortedForLatest[0];

    // Group chapters by volume
    const volumeMap = new Map<string, Chapter[]>();
    this.chapters.forEach(chapter => {
      const volumeName = 'Volume 1'; // Default all chapters to Volume 1 since volumeName doesn't exist in the Chapter interface
      if (!volumeMap.has(volumeName)) {
        volumeMap.set(volumeName, []);
      }
      volumeMap.get(volumeName)?.push(chapter);
    });

    // Convert map to array
    this.volumes = Array.from(volumeMap.entries()).map(([name, chapters]) => ({ name, chapters }));
  }

  startReading(): void {
    if (this.novel?.id) {
      let chapterToRead = 1;
      
      if (this.isLoggedIn() && this.lastReadChapter !== null && this.lastReadChapter !== undefined) {
        chapterToRead = this.lastReadChapter;
      }
      
      this.router.navigate(['/read', this.novel.id, chapterToRead]);
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  navigateToAuthorProfile(userId: number): void {
    this.router.navigate(['/profile', userId]);
  }

  checkLibraryStatus(novelId: number): void {
    if (!this.currentUser?.id) {
      this.isInLibrary = false;
      return;
    }

    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      this.isInLibrary = false;
      return;
    }

    this.libraryService.isNovelInUserLibrary(this.currentUser.id, novelId).subscribe({
      next: (result) => {
        this.isInLibrary = result;
      },
      error: (err) => {
        console.error('Error checking library status:', err);
        // If there's an auth error, we'll assume not in library
        this.isInLibrary = false;
      }
    });
  }

  toggleLibrary(): void {
    if (!this.currentUser?.id || !this.novel?.id || this.libraryLoading) {
      return;
    }
    
    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    
    this.libraryLoading = true;
    this.libraryService.toggleNovelInLibrary(this.currentUser.id, this.novel.id).subscribe({
      next: (response) => {
        // Update the UI state
        this.isInLibrary = !this.isInLibrary;
        this.libraryLoading = false;
        
        // Verify the updated status after toggling
        if (this.novel && this.novel.id) {
          this.checkLibraryStatus(this.novel.id);
        }
      },
      error: (err) => {
        console.error('Error toggling library status:', err);
        this.libraryLoading = false;
      }
    });
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }
  
  rateNovel(rating: number): void {
    if (!this.currentUser?.id || !this.novel?.id) return;
    
    this.novelService.rateNovel(this.novel.id, this.currentUser.id, rating).subscribe({
      next: () => {
        // Update the current novel's rating
        this.refreshNovelRating();
      },
      error: (err) => {
        console.error('Error rating novel:', err);
      }
    });
  }
  
  refreshNovelRating(): void {
    if (!this.novel?.id) return;
    
    const userId = this.currentUser?.id || 0;
    this.novelService.getNovelRating(this.novel.id).subscribe({
      next: (response) => {
        if (this.novel) {
          this.novel.rating = response.averageRating;
          this.novel.ratingsCount = response.ratingsCount;
        }
      },
      error: (err) => {
        console.error('Error fetching novel rating:', err);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  closeAllCommentMenus(event: MouseEvent): void {
    // Закрыть все открытые меню комментариев при клике вне них
    if (this.comments) {
      this.comments.forEach(comment => {
        // Проверяем, был ли клик по кнопке с тремя точками (по классу options-btn)
        const target = event.target as HTMLElement;
        if (!target.classList.contains('options-btn')) {
          comment.showOptions = false;
        }
      });
    }
  }

  toggleCommentOptions(comment: NovelComment, event: MouseEvent): void {
    // Остановить всплытие события, чтобы не сработал document:click
    event.stopPropagation();
    
    // Закрыть все остальные открытые меню
    this.comments.forEach(c => {
      if (c !== comment) {
        c.showOptions = false;
      }
    });
    
    // Переключить меню для текущего комментария
    comment.showOptions = !comment.showOptions;
  }

  checkLastReadChapter(userId: number, novelId: number): void {
    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        const novelEntry = libraryEntries.find(entry => entry.novelId === novelId);
        
        // Проверим структуру объекта
        if (novelEntry) {
          // В C# свойства именуются в PascalCase
          if (novelEntry.LastReadChapter !== undefined) {
            this.lastReadChapter = novelEntry.LastReadChapter;
          } else if (novelEntry.lastReadChapter !== undefined) {
            this.lastReadChapter = novelEntry.lastReadChapter;
          }
        }
      },
      error: (err) => {
        console.error('Error checking last read chapter:', err);
      }
    });
  }

  get readingButtonText(): string {
    const isLoggedIn = this.isLoggedIn();
    const hasLastReadChapter = this.lastReadChapter && this.lastReadChapter >= 1;
    const buttonText = isLoggedIn && hasLastReadChapter ? 'Continue Reading' : 'Start Reading';
    
    return buttonText;
  }

  formatViewsCount(views: number | undefined): string {
    if (!views) return '0';
    
    if (views > 999999) {
      return (views / 1000000).toFixed(1) + 'M';
    } else if (views > 999) {
      return (views / 1000).toFixed(1) + 'K';
    }
    
    return views.toString();
  }

  getNovelStatus(): { text: string; class: string } {
    if (!this.novel?.status) {
      return { text: 'Unknown', class: 'status-unknown' };
    }
    
    switch (this.novel.status) {
      case NovelStatus.InProgress:
        return { text: 'In Progress', class: 'status-in-progress' };
      case NovelStatus.Frozen:
        return { text: 'Frozen', class: 'status-frozen' };
      case NovelStatus.Abandoned:
        return { text: 'Abandoned', class: 'status-abandoned' };
      case NovelStatus.Completed:
        return { text: 'Completed', class: 'status-completed' };
      default:
        return { text: 'Unknown', class: 'status-unknown' };
    }
  }

  goBackToList(): void {
    if (this.previousUrl && this.previousUrl.includes('/browse')) {
      // Если предыдущий URL содержит /browse, используем его
      this.router.navigateByUrl(this.previousUrl);
    } else {
      // Иначе просто возвращаемся на страницу browse
      this.router.navigate(['/browse']);
    }
  }

  toggleSort(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.saveSortDirection();
    this.organizeChapters();
  }
  
  private saveSortDirection(): void {
    localStorage.setItem('novel-chapters-sort', this.sortDirection);
  }
  
  private loadSortDirection(): void {
    const savedDirection = localStorage.getItem('novel-chapters-sort');
    if (savedDirection === 'asc' || savedDirection === 'desc') {
      this.sortDirection = savedDirection;
    }
  }
}
