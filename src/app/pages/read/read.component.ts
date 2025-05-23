import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NovelService, GetChapterDto } from '../../services/novel.service';
import { AuthService, User } from '../../services/auth.service';
import { LibraryService, ToggleReadResponse } from '../../services/library.service';
import { Location } from '@angular/common';
import { AgeVerificationService } from '../../services/age-verification.service';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { HostListener } from '@angular/core';

interface ChapterItem {
  id: number;
  number: number;
  title: string;
}

interface ChapterComment {
  id: number;
  displayName: string;
  userId: number;
  novelId: number;
  chapterId: number;
  content: string;
  publishedDate: string;
  likesCount: number;
  imageUrl?: string; 
  isLiked?: boolean;
  showOptions?: boolean;
}

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
  showChaptersPopup: boolean = false;
  chaptersList: ChapterItem[] = [];
  private previousUrl: string | null = null;

  // Comment-related properties
  comments: ChapterComment[] = [];
  commentsLoading: boolean = false;
  commentForm: FormGroup;
  commentError: string = '';
  likedComments: Set<number> = new Set();
  deletingComment: boolean = false;
  showDeleteSuccess: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private novelService: NovelService,
    public authService: AuthService,
    private libraryService: LibraryService,
    private location: Location,
    private ageVerificationService: AgeVerificationService,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private fb: FormBuilder,
    private userService: UserService
  ) {
    // Пытаемся получить предыдущий URL из истории состояния
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.previousUrl = navigation.extras.state['prevUrl'] as string;
      console.log('Previous URL from state:', this.previousUrl);
    }

    // Initialize comment form
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(1000)]]
    });
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
        this.loadChaptersList();
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

  loadChaptersList(): void {
    this.novelService.getAllChapters(this.novelId).subscribe({
      next: (chapters) => {
        this.chaptersList = chapters.map(chapter => ({
          id: chapter.id,
          number: chapter.chapterNumber,
          title: chapter.title
        }));
      },
      error: (err) => {
        console.error('Error loading chapters list:', err);
      }
    });
  }

  toggleChaptersPopup(): void {
    this.showChaptersPopup = !this.showChaptersPopup;
    // When opening the popup, ensure chapters list is loaded
    if (this.showChaptersPopup && this.chaptersList.length === 0) {
      this.loadChaptersList();
    }
  }

  closeChaptersPopup(event: MouseEvent): void {
    // Only close if clicking the overlay or the close button
    if (
      (event.target as HTMLElement).classList.contains('chapters-popup-overlay') ||
      (event.target as HTMLElement).closest('.close-btn')
    ) {
      this.showChaptersPopup = false;
      event.stopPropagation();
    }
  }

  goToChapter(chapterNumber: number): void {
    if (chapterNumber === this.chapterNumber) {
      // If same chapter, just close the popup
      this.showChaptersPopup = false;
      return;
    }
    
    this.chapterNumber = chapterNumber;
    this.loadChapter();
    this.showChaptersPopup = false;
    
    // Ensure scroll position is reset when navigating directly to a chapter
    window.scrollTo(0, 0);
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
          
          // Load chapter comments
          if (chapter.id) {
            this.fetchComments(chapter.id);
          }
          
          // Scroll to the top of the page when a new chapter is loaded
          window.scrollTo(0, 0);
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

  // Comment-related methods
  fetchComments(chapterId: number): void {
    this.commentsLoading = true;
    
    this.http.get<ChapterComment[]>(`https://localhost:7188/api/Comment/get-chapter-comment/${chapterId}`)
      .subscribe({
        next: (comments) => {
          // Sort comments by date (newest first)
          this.comments = comments.sort((a, b) => {
            return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
          });
          
          // Ensure chapterId is set for all comments
          this.comments.forEach(comment => {
            comment.chapterId = chapterId; // Ensure chapterId is set
            this.loadCommentUserAvatar(comment);
            
            // Check if current user has liked the comment
            const currentUser = this.authService.currentUserValue;
            if (currentUser?.id) {
              this.checkIfCommentLiked(comment.id, currentUser.id);
            }
          });
          
          this.commentsLoading = false;
        },
        error: (error) => {
          console.error('Error fetching comments:', error);
          // If the error is "Not Have Comments", set comments to empty array
          if (error.error === "Not Have Comments" || error.message?.includes("Not Have Comments")) {
            this.comments = [];
          }
          this.commentsLoading = false;
        }
      });
  }
  
  loadCommentUserAvatar(comment: ChapterComment): void {
    comment.imageUrl = this.userService.getProfileImageUrl(comment.userId);
  }
  
  checkIfCommentLiked(commentId: number, userId: number): void {
    this.http.get<boolean>(`https://localhost:7188/api/Comment/has-user-liked-chapter-comment/${commentId}/${userId}`)
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
  
  submitComment(): void {
    if (!this.commentForm.valid || !this.authService.currentUserValue?.id || !this.chapter?.id) {
      return;
    }
    
    const userId = this.authService.currentUserValue.id;
    const chapterId = this.chapter.id;
    
    // Create the DTO that matches CreateChapterCommentDto expected by the API
    const commentData = {
      displayName: this.authService.currentUserValue.userName || 'Anonymous',
      content: this.commentForm.value.content,
      publishedDate: new Date().toISOString(),
      likeCount: 0
    };
    
    this.http.post(
      `https://localhost:7188/api/Comment/send-chapter-comment/${userId}/${chapterId}`,
      commentData
    ).subscribe({
      next: (response) => {
        // Refresh comments list
        if (this.chapter?.id) {
          this.fetchComments(this.chapter.id);
        }
        // Reset form
        this.commentForm.reset();
        this.commentError = '';
      },
      error: (error: any) => {
        console.error('Error submitting comment:', error);
        this.commentError = error.error || error.message || 'Failed to submit comment. Please try again.';
      }
    });
  }
  
  likeComment(commentId: number): void {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser?.id) {
      return;
    }
    
    // Call the API to toggle like status
    this.http.post<boolean>(`https://localhost:7188/api/Comment/set-chapter-comment-like/${commentId}/${currentUser.id}`, {})
      .subscribe({
        next: (isLiked) => {
          // Update the UI based on server response
          const comment = this.comments.find(c => c.id === commentId);
          if (comment) {
            comment.isLiked = isLiked;
            
            // Update like count - increment or decrement based on liked status
            if (isLiked) {
              comment.likesCount += 1;
              this.likedComments.add(commentId);
            } else {
              comment.likesCount = Math.max(0, comment.likesCount - 1);
              this.likedComments.delete(commentId);
            }
          }
          
          // If the chapter ID is available, refresh all comments to get the updated data
          if (this.chapter?.id) {
            this.fetchComments(this.chapter.id);
          }
        },
        error: (error: any) => {
          console.error('Error toggling comment like:', error);
          
          // If there was an error, refresh the like status to ensure UI is correct
          if (currentUser?.id) {
            this.checkIfCommentLiked(commentId, currentUser.id);
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
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      if (img.alt && img.alt.includes('avatar')) {
        img.src = 'assets/images/default-avatar.png';
      }
    }
  }

  // New methods for comment option management
  toggleCommentOptions(comment: ChapterComment, event: Event): void {
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
  deleteComment(comment: ChapterComment): void {
    if (!this.authService.currentUserValue?.id || this.deletingComment) {
      return;
    }
    
    const userId = this.authService.currentUserValue.id;
    this.deletingComment = true;
    
    // Use the appropriate API endpoint for chapter comments
    this.http.delete(`https://localhost:7188/api/Comment/delete-chapter-comments/${comment.id}/${comment.chapterId}/${userId}`)
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
        error: (error: any) => {
          console.error('Error deleting comment:', error);
          this.deletingComment = false;
          // You could show an error message here if needed
        }
      });
  }
  
  // Check if user can delete a comment (either author or admin)
  canDeleteComment(comment: ChapterComment): boolean {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) return false;
    
    // User can delete if they are the author or an admin
    return currentUser.id === comment.userId || 
           currentUser.roleName === 'Admin';
  }
}
