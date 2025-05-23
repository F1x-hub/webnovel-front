import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NovelService, Chapter } from '../../services/novel.service';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { LibraryService } from '../../services/library.service';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { AgeVerificationService } from '../../services/age-verification.service';
import { HttpClient } from '@angular/common/http';

interface Volume {
  name: string;
  chapters: Chapter[];
}

interface NovelComment {
  id: number;
  displayName: string;
  content: string;
  publishedDate: string;
  likesCount: number;
  imageUrl?: string;
  isLiked?: boolean;
  userId?: number;
  novelId?: number;
  showOptions?: boolean;
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
  
  // Comment-related properties
  comments: NovelComment[] = [];
  commentsLoading = false;
  commentForm: FormGroup;
  commentError = '';
  likedComments: Set<number> = new Set();
  deletingComment = false;
  showDeleteSuccess = false;
  
  private previousUrl: string | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private novelService: NovelService,
    private authService: AuthService,
    private userService: UserService,
    private libraryService: LibraryService,
    private fb: FormBuilder,
    private location: Location,
    private ageVerificationService: AgeVerificationService,
    private http: HttpClient
  ) { 
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(1000)]]
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      // Check if the image is an avatar or a novel cover
      if (img.alt && img.alt.includes('avatar')) {
        img.src = 'assets/images/default-avatar.png';
      } else {
        img.src = 'assets/images/default-cover.png';
        // Force a re-render by triggering onload
        setTimeout(() => {
          this.coverImageLoaded = true;
        }, 100);
      }
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
        this.fetchComments(id);
        
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

    // Try to get previous URL from history state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.previousUrl = navigation.extras.state['prevUrl'] as string;
    }
  }
  
  ngOnDestroy(): void {
    // Cleanup
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
        
        // Check if the user has a last read chapter
        if (this.currentUser?.id && novel.id) {
          this.checkLastReadChapter(this.currentUser.id, novel.id);
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching novel:', error);
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
      error: (error) => {
        console.error('Error fetching author:', error);
      }
    });
  }

  fetchChapters(novelId: number): void {
    this.novelService.getAllChapters(novelId).subscribe({
      next: (chapters) => {
        this.chapters = chapters;
        if (chapters.length > 0) {
          // Set latest chapter 
          this.latestChapter = this.sortDirection === 'asc' 
            ? chapters[chapters.length - 1] 
            : chapters[0];
        }
        this.organizeChapters();
      },
      error: (error) => {
        console.error('Error fetching chapters:', error);
        this.chapters = [];
        this.organizeChapters();
      }
    });
  }

  organizeChapters(): void {
    // Sort chapters
    const sortedChapters = [...this.chapters];
    if (this.sortDirection === 'desc') {
      sortedChapters.sort((a, b) => b.chapterNumber - a.chapterNumber);
    } else {
      sortedChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
    
    // Group chapters by volume
    const volumeMap = new Map<string, Chapter[]>();
    
    sortedChapters.forEach(chapter => {
      // Since volumeName doesn't exist in the interface, use a default
      const volumeName = 'Volume 1';
      if (!volumeMap.has(volumeName)) {
        volumeMap.set(volumeName, []);
      }
      volumeMap.get(volumeName)!.push(chapter);
    });
    
    // Convert to array of volumes
    this.volumes = Array.from(volumeMap.entries()).map(([name, chapters]) => {
      return { name, chapters };
    });
    
    // Sort volumes by name
    this.volumes.sort((a, b) => {
      const volNumA = parseInt(a.name.replace(/\D/g, '')) || 0;
      const volNumB = parseInt(b.name.replace(/\D/g, '')) || 0;
      return volNumA - volNumB;
    });
  }

  startReading(): void {
    if (this.novel && this.chapters.length > 0) {
      // If the user has a last read chapter, go to that
      if (this.lastReadChapter && this.chapters.some(c => c.chapterNumber === this.lastReadChapter)) {
        this.router.navigate(['/read', this.novel.id, this.lastReadChapter]);
      } else {
        // Otherwise go to the first chapter
        const firstChapter = this.chapters.reduce(
          (min, chapter) => chapter.chapterNumber < min.chapterNumber ? chapter : min,
          this.chapters[0]
        );
        this.router.navigate(['/read', this.novel.id, firstChapter.chapterNumber]);
      }
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
    
    this.libraryLoading = true;
    
    this.libraryService.isNovelInUserLibrary(this.currentUser.id, novelId).subscribe({
      next: (inLibrary) => {
        this.isInLibrary = inLibrary;
        this.libraryLoading = false;
      },
      error: (error) => {
        console.error('Error checking library status:', error);
        this.libraryLoading = false;
      }
    });
  }

  toggleLibrary(): void {
    if (!this.currentUser?.id || !this.novel?.id || this.libraryLoading) {
      return;
    }
    
    this.libraryLoading = true;
    
    this.libraryService.toggleNovelInLibrary(this.currentUser.id, this.novel.id).subscribe({
      next: () => {
        this.isInLibrary = !this.isInLibrary;
        this.libraryLoading = false;
      },
      error: (error) => {
        console.error('Error toggling library status:', error);
        this.libraryLoading = false;
      }
    });
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  rateNovel(rating: number): void {
    if (!this.currentUser?.id || !this.novel?.id) {
      return;
    }
    
    this.novelService.rateNovel(this.novel.id, this.currentUser.id, rating).subscribe({
      next: () => {
        // Update the novel's rating
        this.refreshNovelRating();
      },
      error: (error) => {
        console.error('Error rating novel:', error);
      }
    });
  }

  refreshNovelRating(): void {
    if (!this.novel?.id) return;
    
    this.novelService.getNovelRating(this.novel.id).subscribe({
      next: (ratingData) => {
        if (this.novel) {
          this.novel.rating = ratingData.averageRating;
          this.novel.ratingsCount = ratingData.ratingsCount;
        }
      },
      error: (error) => {
        console.error('Error refreshing novel rating:', error);
      }
    });
  }

  checkLastReadChapter(userId: number, novelId: number): void {
    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        const novelEntry = libraryEntries.find(entry => entry.novelId === novelId);
        
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
            this.lastReadChapter = chapter;
          } else {
            this.lastReadChapter = null;
          }
        }
      },
      error: (error) => {
        console.error('Error getting last read chapter:', error);
      }
    });
  }

  get readingButtonText(): string {
    const isLoggedIn = this.isLoggedIn();
    const hasLastReadChapter = this.lastReadChapter && this.lastReadChapter > 0;
    
    if (isLoggedIn && hasLastReadChapter) {
      return `Continue with chapter ${this.lastReadChapter}`;
    } else {
      return 'Start Reading';
    }
  }

  formatViewsCount(views: number | undefined): string {
    if (views === undefined) return '0';
    
    if (views < 1000) return views.toString();
    
    if (views < 1000000) {
      return (views / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    
    return (views / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  getNovelStatus(): { text: string; class: string } {
    if (!this.novel || this.novel.status === undefined) {
      return { text: 'Unknown', class: 'status-unknown' };
    }
    
    switch (this.novel.status) {
      case NovelStatus.InProgress:
        return { text: 'In Progress', class: 'status-in-progress' };
      case NovelStatus.Completed:
        return { text: 'Completed', class: 'status-completed' };
      case NovelStatus.Frozen:
        return { text: 'On Hiatus', class: 'status-hiatus' };
      case NovelStatus.Abandoned:
        return { text: 'Dropped', class: 'status-dropped' };
      default:
        return { text: 'Unknown', class: 'status-unknown' };
    }
  }

  goBackToList(): void {
    if (this.previousUrl) {
      this.router.navigateByUrl(this.previousUrl);
    } else {
      this.location.back();
    }
  }

  toggleSort(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.organizeChapters();
    this.saveSortDirection();
  }

  private saveSortDirection(): void {
    localStorage.setItem('chapterSortDirection', this.sortDirection);
  }

  private loadSortDirection(): void {
    const savedDirection = localStorage.getItem('chapterSortDirection');
    if (savedDirection === 'asc' || savedDirection === 'desc') {
      this.sortDirection = savedDirection;
    }
  }

  // Comments-related methods
  fetchComments(novelId: number): void {
    this.commentsLoading = true;
    this.http.get<NovelComment[]>(`https://localhost:7188/api/Comment/get-novel-comment/${novelId}`)
      .subscribe({
        next: (comments) => {
          // Sort comments by date (newest first)
          this.comments = comments.sort((a, b) => {
            return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
          });
          
          // Set novelId for all comments to current novel
          this.comments.forEach(comment => {
            comment.novelId = novelId; // Ensure novelId is set
            this.loadCommentUserAvatar(comment);
            this.fetchCommentLikes(comment);
            
            // Check if current user has liked the comment
            if (this.currentUser?.id) {
              this.checkIfCommentLiked(comment.id, this.currentUser.id);
            }
          });
          
          this.commentsLoading = false;
        },
        error: (error) => {
          console.error('Error fetching comments:', error);
          this.commentsLoading = false;
        }
      });
  }
  
  fetchCommentLikes(comment: NovelComment): void {
    this.http.get<number>(`https://localhost:7188/api/Comment/get-novel-comment-like/${comment.id}`)
      .subscribe({
        next: (likeCount) => {
          comment.likesCount = likeCount;
        },
        error: (error) => {
          console.error(`Error fetching likes for comment ${comment.id}:`, error);
        }
      });
  }
  
  checkIfCommentLiked(commentId: number, userId: number): void {
    this.http.get<boolean>(`https://localhost:7188/api/Comment/has-user-liked-novel-comment/${commentId}/${userId}`)
      .subscribe({
        next: (hasLiked) => {
          const comment = this.comments.find(c => c.id === commentId);
          if (comment) {
            comment.isLiked = hasLiked;
            
            // Update local tracking of likes for consistency
            if (hasLiked) {
              this.likedComments.add(commentId);
            } else {
              this.likedComments.delete(commentId);
            }
          }
        },
        error: (error) => {
          console.error(`Error checking like status for comment ${commentId}:`, error);
        }
      });
  }
  
  loadCommentUserAvatar(comment: NovelComment): void {
    comment.imageUrl = this.userService.getProfileImageUrl(comment.id);
  }

  submitComment(): void {
    if (!this.commentForm.valid || !this.currentUser?.id || !this.novel?.id) {
      return;
    }

    const commentData = {
      displayName: this.currentUser.userName || 'Anonymous',
      content: this.commentForm.value.content,
      publishedDate: new Date().toISOString(),
      likeCount: 0
    };

    this.http.post(
      `https://localhost:7188/api/Comment/send-novel-comment/${this.currentUser.id}/${this.novel.id}`,
      commentData
    ).subscribe({
      next: () => {
        // Refresh comments list
        if (this.novel?.id) {
          this.fetchComments(this.novel.id);
        }
        // Reset form
        this.commentForm.reset();
      },
      error: (error) => {
        console.error('Error submitting comment:', error);
        this.commentError = 'Failed to submit comment. Please try again.';
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  // Add a method to handle liking a comment
  likeComment(commentId: number): void {
    if (!this.currentUser?.id) {
      return;
    }
    
    // Call the API to toggle like status
    this.http.post<boolean>(`https://localhost:7188/api/Comment/set-novel-comment-like/${commentId}/${this.currentUser.id}`, {})
      .subscribe({
        next: (isLiked) => {
          // Update the UI based on server response
          const comment = this.comments.find(c => c.id === commentId);
          if (comment) {
            comment.isLiked = isLiked;
            
            // Update like count
            this.fetchCommentLikes(comment);
            
            // Update local tracking of liked comments for consistency
            if (isLiked) {
              this.likedComments.add(commentId);
            } else {
              this.likedComments.delete(commentId);
            }
          }
        },
        error: (error) => {
          console.error('Error toggling comment like:', error);
          
          // If there was an error, refresh the like status to ensure UI is correct
          if (this.currentUser?.id) {
            this.checkIfCommentLiked(commentId, this.currentUser.id);
          }
        }
      });
  }

  isCommentLiked(commentId: number): boolean {
    const comment = this.comments.find(c => c.id === commentId);
    return comment?.isLiked || false;
  }

  formatLikeCount(count: number): string {
    if (!count && count !== 0) return '0';
    
    if (count < 1000) {
      return count.toString();
    }
    
    if (count < 1000000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  }

  // New methods for comment options management
  toggleCommentOptions(comment: NovelComment, event: Event): void {
    event.stopPropagation();
    // Close all other comment options
    this.comments.forEach(c => {
      if (c.id !== comment.id) {
        c.showOptions = false;
      }
    });
    // Toggle this comment's options
    comment.showOptions = !comment.showOptions;
  }
  
  closeAllCommentOptions(): void {
    this.comments.forEach(comment => comment.showOptions = false);
  }
  
  // Add click listener to document to close comment options when clicking outside
  @HostListener('document:click')
  closeOptionsOnOutsideClick(): void {
    this.closeAllCommentOptions();
  }
  
  // Delete comment method
  deleteComment(comment: NovelComment): void {
    if (!this.currentUser?.id || this.deletingComment || !this.novel?.id) {
      return;
    }
    
    const userId = this.currentUser.id;
    const novelId = this.novel.id;
    this.deletingComment = true;
    
    // Use the appropriate API endpoint for novel comments
    this.http.delete(`https://localhost:7188/api/Comment/delete-novel-comments/${comment.id}/${novelId}/${userId}`)
      .subscribe({
        next: () => {
          // Show success notification
          this.showDeleteSuccess = true;
          setTimeout(() => {
            this.showDeleteSuccess = false;
          }, 3000);
          
          // Remove comment from list
          this.comments = this.comments.filter(c => c.id !== comment.id);
          this.deletingComment = false;
        },
        error: (error) => {
          console.error('Error deleting comment:', error);
          this.deletingComment = false;
          // You could show an error message here if needed
        }
      });
  }
  
  // Check if user can delete a comment (either author or admin)
  canDeleteComment(comment: NovelComment): boolean {
    if (!this.currentUser) return false;
    
    // User can delete if they are the author or an admin
    return this.currentUser.id === comment.userId || 
           this.currentUser.roleName === 'Admin';
  }
}
