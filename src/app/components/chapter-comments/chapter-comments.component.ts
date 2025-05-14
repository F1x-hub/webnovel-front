import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommentService } from '../../services/comment.service';
import { ChapterComment } from '../../models/chapter-comment.model';
import { CreateChapterCommentDto } from '../../services/comment.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chapter-comments',
  templateUrl: './chapter-comments.component.html',
  styleUrls: ['./chapter-comments.component.css']
})
export class ChapterCommentsComponent implements OnInit, OnDestroy {
  @Input() chapterId: number = 0;
  
  comments: ChapterComment[] = [];
  commentForm: FormGroup;
  isSubmitting = false;
  loadingComments = true;
  commentError = '';
  userLikedComments: Record<number, boolean> = {};
  isDeletingComment: number | null = null;
  activePopupCommentId: number | null = null;
  
  private commentsSubscription?: Subscription;
  
  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(1000)]]
    });
  }
  
  ngOnInit() {
    this.loadComments();
    
    this.commentsSubscription = this.commentService.chapterComments$.subscribe(comments => {
      this.comments = comments;
      if (comments.length > 0) {
        console.log('Comment object structure:', JSON.stringify(comments[0]));
      }
      this.checkUserLikes();
    });
  }
  
  ngOnDestroy() {
    if (this.commentsSubscription) {
      this.commentsSubscription.unsubscribe();
    }
    // Disconnect from SignalR when component is destroyed
    this.commentService.disconnect();
  }
  
  loadComments() {
    this.loadingComments = true;
    this.commentError = '';
    
    this.commentService.getChapterComments(this.chapterId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.loadingComments = false;
        this.checkUserLikes();
      },
      error: (err) => {
        this.loadingComments = false;
        if (err.error === 'Not Have Comments') {
          this.comments = [];
        } else {
          this.commentError = err.error || 'Failed to load comments';
        }
      }
    });
  }
  
  submitComment() {
    if (!this.authService.isLoggedIn) {
      return;
    }
    
    if (this.commentForm.invalid || this.isSubmitting) {
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      return;
    }
    
    // Get user information
    const user = this.authService.currentUserValue;
    const displayName = user?.userName || 'Anonymous';
    
    // Match exact structure expected by backend
    const commentData: CreateChapterCommentDto = {
      displayName: displayName,
      content: this.commentForm.value.content,
      publishedDate: new Date().toISOString(),
      likeCount: 0
    };
    
    console.log('Submitting comment with userId:', userId, 'chapterId:', this.chapterId);
    console.log('Comment data:', commentData);
    this.isSubmitting = true;
    
    this.commentService.sendComment(userId, this.chapterId, commentData).subscribe({
      next: (response) => {
        console.log('Comment submitted successfully:', response);
        this.commentForm.reset();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Comment submission error:', err);
        this.isSubmitting = false;
        
        // Better error handling for various error types
        if (err.status === 401) {
          this.commentError = 'You must be logged in to post comments';
        } else if (err.status === 403) {
          this.commentError = 'You do not have permission to post comments';
        } else {
          this.commentError = err.error?.message || err.error?.title || err.error || 'Failed to post comment';
        }
      }
    });
  }
  
  toggleLike(commentId: number) {
    if (!this.authService.isLoggedIn) {
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      return;
    }
    
    this.commentService.toggleCommentLike(commentId, userId).subscribe({
      next: (liked) => {
        this.userLikedComments[commentId] = liked;
        
        // Update the like count in the UI - will be overridden by SignalR updates
        const updatedComments = this.comments.map(comment => {
          if (comment.id === commentId) {
            const delta = liked ? 1 : -1;
            const currentLikes = comment.likes || 0;
            return { ...comment, likes: currentLikes + delta };
          }
          return comment;
        });
        
        this.comments = updatedComments;
      },
      error: (err) => {
        console.error('Error toggling like:', err);
      }
    });
  }
  
  private checkUserLikes() {
    if (!this.authService.isLoggedIn || this.comments.length === 0) {
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      return;
    }
    
    this.comments.forEach(comment => {
      this.commentService.hasUserLikedComment(comment.id, userId).subscribe({
        next: (hasLiked) => {
          this.userLikedComments[comment.id] = hasLiked;
        },
        error: () => {
          this.userLikedComments[comment.id] = false;
        }
      });
    });
  }
  
  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }
  
  formatDate(dateString: string | undefined): string {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    return date.toLocaleString();
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
  
  // Добавить обработчик клика для закрытия всплывающих меню при клике вне них
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllPopups();
  }
  
  isCurrentUserComment(commentUserId: number): boolean {
    if (!this.authService.isLoggedIn) {
      return false;
    }
    
    const currentUserId = this.authService.currentUserValue?.id;
    
    // Проверка на null или undefined
    if (commentUserId === undefined || commentUserId === null) {
      // Проверяем разные варианты полей с ID пользователя
      return true; // Временно показываем кнопку удаления для всех
    }
    
    // Включаем кнопку удаления для комментариев с ID пользователя 1 и 6
    if (commentUserId === 1 || commentUserId === 6) {
      return true;
    }
    
    return currentUserId === commentUserId;
  }
  
  // Вспомогательный метод для отображения ключей объекта комментария
  getCommentKeys(comment: ChapterComment): string[] {
    return Object.keys(comment);
  }
  
  deleteComment(commentId: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (!this.authService.isLoggedIn) {
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      return;
    }
    
    this.isDeletingComment = commentId;
    this.activePopupCommentId = null;
    
    this.commentService.deleteComment(commentId, this.chapterId, userId).subscribe({
      next: () => {
        this.isDeletingComment = null;
        // Removing from UI is handled in the service
      },
      error: (err) => {
        this.isDeletingComment = null;
        
        let errorMessage = 'Failed to delete comment';
        if (err.status === 401) {
          errorMessage = 'Требуется авторизация. Пожалуйста, войдите в систему заново.';
        } else if (err.status === 403) {
          errorMessage = 'У вас нет прав на удаление этого комментария';
        } else if (err.status === 404) {
          errorMessage = 'Комментарий не найден';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.error) {
          errorMessage = err.error;
        }
        
        // Show a temporary error message for the delete operation
        this.commentError = errorMessage;
        setTimeout(() => {
          if (this.commentError === errorMessage) {
            this.commentError = '';
          }
        }, 3000);
      }
    });
  }
} 