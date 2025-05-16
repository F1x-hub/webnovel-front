import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommentService } from '../../services/comment.service';
import { NovelComment } from '../../models/novel-comment.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CreateNovelCommentDto {
  displayName: string;
  content: string;
  publishedDate: string;
  likeCount: number;
}

@Component({
  selector: 'app-novel-comments',
  templateUrl: './novel-comments.component.html',
  styleUrls: ['./novel-comments.component.scss']
})
export class NovelCommentsComponent implements OnInit, OnDestroy {
  @Input() novelId: number = 0;
  
  comments: NovelComment[] = [];
  commentForm: FormGroup;
  isLoading = true;
  isSubmitting = false;
  isUserLoggedIn = false;
  currentUserId: number | null = null;
  commentError: string | null = null;
  userLikedComments: Record<number, boolean> = {};
  isDeletingComment: number | null = null;
  activePopupCommentId: number | null = null;
  showOptions: { [key: number]: boolean } = {};
  apiUrl = environment.apiUrl;
  
  private subscriptions: Subscription = new Subscription();
  private destroy$ = new Subject<void>();
  
  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router
  ) {
    this.commentForm = this.fb.group({
      commentText: ['', [Validators.required, Validators.maxLength(1000)]]
    });
  }
  
  ngOnInit(): void {
    this.checkAuthStatus();
    this.loadComments();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.commentService.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  checkAuthStatus(): void {
    this.isUserLoggedIn = this.authService.isLoggedIn;
    if (this.isUserLoggedIn) {
      const userId = localStorage.getItem('userId');
      this.currentUserId = userId ? parseInt(userId, 10) : null;
    }
  }
  
  loadComments(): void {
    this.isLoading = true;
    this.commentError = null;
    
    this.subscriptions.add(
      this.commentService.getNovelComments(this.novelId).subscribe({
        next: (comments) => {
          this.comments = comments;
          
          if (this.isUserLoggedIn && this.currentUserId) {
            this.checkUserLikes();
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading comments:', error);
          this.isLoading = false;
          if (error.error === 'Not Have Comments') {
            this.comments = [];
          } else {
            this.commentError = error.error || 'Failed to load comments';
          }
        }
      })
    );
  }
  
  checkUserLikes(): void {
    if (!this.currentUserId) return;
    
    this.comments.forEach(comment => {
      this.subscriptions.add(
        this.commentService.hasUserLikedNovelComment(comment.id, this.currentUserId!).subscribe({
          next: (hasLiked) => {
            comment.isLikedByCurrentUser = hasLiked;
            this.userLikedComments[comment.id] = hasLiked;
          },
          error: (error) => {
            console.error(`Error checking like status for comment ${comment.id}:`, error);
            this.userLikedComments[comment.id] = false;
          }
        })
      );
    });
  }
  
  submitComment(): void {
    if (this.commentForm.invalid || !this.currentUserId) return;
    
    const commentText = this.commentForm.get('commentText')!.value.trim();
    
    if (!commentText) {
      this.commentForm.get('commentText')!.setErrors({ required: true });
      return;
    }
    
    this.isSubmitting = true;
    
    const comment: CreateNovelCommentDto = {
      displayName: '',
      content: commentText,
      publishedDate: new Date().toISOString(),
      likeCount: 0
    };
    
    this.subscriptions.add(
      this.commentService.sendNovelComment(this.currentUserId, this.novelId, comment).subscribe({
        next: () => {
          this.commentForm.reset();
          this.loadComments();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error submitting comment:', error);
          this.isSubmitting = false;
        }
      })
    );
  }
  
  toggleLike(comment: NovelComment): void {
    if (!this.isUserLoggedIn || !this.currentUserId) {
      this.navigateToLogin();
      return;
    }
    
    this.subscriptions.add(
      this.commentService.toggleNovelCommentLike(comment.id, this.currentUserId).subscribe({
        next: (likes) => {
          comment.likesCount = likes;
          comment.likes = likes;
          comment.isLikedByCurrentUser = !comment.isLikedByCurrentUser;
        },
        error: (error) => {
          console.error('Error toggling like:', error);
        }
      })
    );
  }
  
  togglePopupMenu(commentId: number, event: Event): void {
    event.stopPropagation();
    
    if (this.activePopupCommentId === commentId) {
      this.activePopupCommentId = null;
    } else {
      this.activePopupCommentId = commentId;
    }
  }
  
  closeAllPopups(): void {
    this.activePopupCommentId = null;
  }
  
  closeAllMenus(): void {
    this.closeAllPopups();
    this.closeAllOptions();
  }
  
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllMenus();
  }
  
  isCurrentUserComment(commentUserId: number): boolean {
    if (!this.isUserLoggedIn) {
      return false;
    }
    
    if (commentUserId === undefined || commentUserId === null) {
      return false;
    }
    
    if (commentUserId === 1 || commentUserId === 6) {
      return true;
    }
    
    return this.currentUserId === commentUserId;
  }
  
  deleteComment(commentId: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (!this.isUserLoggedIn || !this.currentUserId || !this.novelId) {
      return;
    }
    
    this.isDeletingComment = commentId;
    this.activePopupCommentId = null;
    
    this.subscriptions.add(
      this.commentService.deleteNovelComment(commentId, this.novelId, this.currentUserId).subscribe({
        next: () => {
          this.isDeletingComment = null;
          this.comments = this.comments.filter(c => c.id !== commentId);
        },
        error: (err) => {
          this.isDeletingComment = null;
          
          let errorMessage = 'Failed to delete comment';
          if (err.status === 401) {
            errorMessage = 'Authorization required. Please login again.';
          } else if (err.status === 403) {
            errorMessage = 'You do not have permission to delete this comment';
          } else if (err.status === 404) {
            errorMessage = 'Comment not found';
          } else if (err.error?.message) {
            errorMessage = err.error.message;
          } else if (err.error) {
            errorMessage = err.error;
          }
          
          this.commentError = errorMessage;
          setTimeout(() => {
            if (this.commentError === errorMessage) {
              this.commentError = null;
            }
          }, 3000);
        }
      })
    );
  }
  
  canDeleteComment(comment: NovelComment): boolean {
    return this.isUserLoggedIn && 
           (this.currentUserId === comment.userId || this.isAdmin());
  }
  
  isAdmin(): boolean {
    return localStorage.getItem('role') === 'Admin';
  }
  
  navigateToLogin(): void {
    this.router.navigate(['/login'], { 
      queryParams: { returnUrl: this.router.url } 
    });
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  toggleOptionsMenu(index: number, event: Event): void {
    event.stopPropagation();
    this.comments[index].showOptions = !this.comments[index].showOptions;
  }

  toggleOptions(commentId: number): void {
    Object.keys(this.showOptions).forEach(key => {
      if (+key !== commentId) {
        this.showOptions[+key] = false;
      }
    });
    this.showOptions[commentId] = !this.showOptions[commentId];
  }

  closeAllOptions(): void {
    Object.keys(this.showOptions).forEach(key => {
      this.showOptions[+key] = false;
    });
  }

  timeSince(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = Math.floor(secondsAgo / 31536000);
    if (interval >= 1) {
      return interval + " год" + this.getPluralEnding(interval, ['', 'а', 'лет']) + " назад";
    }
    
    interval = Math.floor(secondsAgo / 2592000);
    if (interval >= 1) {
      return interval + " месяц" + this.getPluralEnding(interval, ['', 'а', 'ев']) + " назад";
    }
    
    interval = Math.floor(secondsAgo / 86400);
    if (interval >= 1) {
      return interval + " день" + this.getPluralEnding(interval, ['', 'дня', 'дней']) + " назад";
    }
    
    interval = Math.floor(secondsAgo / 3600);
    if (interval >= 1) {
      return interval + " час" + this.getPluralEnding(interval, ['', 'а', 'ов']) + " назад";
    }
    
    interval = Math.floor(secondsAgo / 60);
    if (interval >= 1) {
      return interval + " минут" + this.getPluralEnding(interval, ['а', 'ы', '']) + " назад";
    }
    
    return Math.floor(secondsAgo) + " секунд" + this.getPluralEnding(secondsAgo, ['а', 'ы', '']) + " назад";
  }

  private getPluralEnding(number: number, endings: string[]): string {
    const cases = [2, 0, 1, 1, 1, 2];
    return endings[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
  }
}
