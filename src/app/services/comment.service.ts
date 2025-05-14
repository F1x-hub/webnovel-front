import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, catchError, throwError, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { ChapterComment } from '../models/chapter-comment.model';
import { NovelComment } from '../models/novel-comment.model';

export interface CreateChapterCommentDto {
  displayName: string;
  content: string;
  publishedDate: string;
  likeCount: number;
}

export interface CreateNovelCommentDto {
  displayName: string;
  content: string;
  publishedDate: string;
  likeCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private hubConnection!: signalR.HubConnection;
  private apiUrl = environment.apiUrl;
  
  private chapterCommentsSubject = new BehaviorSubject<ChapterComment[]>([]);
  public chapterComments$ = this.chapterCommentsSubject.asObservable();
  
  private novelCommentsSubject = new BehaviorSubject<NovelComment[]>([]);
  public novelComments$ = this.novelCommentsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.createHubConnection();
  }

  private createHubConnection() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/commentHub`)
      .configureLogging(signalR.LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    this.startHubConnection();

    // Listen for new chapter comments
    this.hubConnection.on('ReceiveComment', (comment: any) => {
      // Определяем тип комментария (к главе или к новелле)
      if (comment.chapterId !== undefined) {
        // Это комментарий к главе
        const chapterComment = comment as ChapterComment;
        if (chapterComment.likesCount !== undefined && chapterComment.likes === undefined) {
          chapterComment.likes = chapterComment.likesCount;
        }
        const currentComments = this.chapterCommentsSubject.value;
        this.chapterCommentsSubject.next([...currentComments, chapterComment]);
      } else if (comment.novelId !== undefined) {
        // Это комментарий к новелле
        const novelComment = comment as NovelComment;
        if (novelComment.likesCount !== undefined && novelComment.likes === undefined) {
          novelComment.likes = novelComment.likesCount;
        }
        const currentComments = this.novelCommentsSubject.value;
        this.novelCommentsSubject.next([...currentComments, novelComment]);
      }
    });

    // Listen for comment likes updates
    this.hubConnection.on('ReceiveLikeUpdate', (data: { commentId: number, likes: number }) => {
      // Обновляем лайки для комментариев главы
      const chapterComments = this.chapterCommentsSubject.value;
      const updatedChapterComments = chapterComments.map(comment => {
        if (comment.id === data.commentId) {
          return { ...comment, likes: data.likes };
        }
        return comment;
      });
      this.chapterCommentsSubject.next(updatedChapterComments);
      
      // Обновляем лайки для комментариев новеллы
      const novelComments = this.novelCommentsSubject.value;
      const updatedNovelComments = novelComments.map(comment => {
        if (comment.id === data.commentId) {
          return { ...comment, likes: data.likes };
        }
        return comment;
      });
      this.novelCommentsSubject.next(updatedNovelComments);
    });

    // Добавляем обработчик события CommentDeleted
    this.hubConnection.on('CommentDeleted', (commentId: number) => {
      // Удаляем из комментариев главы
      const chapterComments = this.chapterCommentsSubject.value;
      const updatedChapterComments = chapterComments.filter(comment => comment.id !== commentId);
      this.chapterCommentsSubject.next(updatedChapterComments);
      
      // Удаляем из комментариев новеллы
      const novelComments = this.novelCommentsSubject.value;
      const updatedNovelComments = novelComments.filter(comment => comment.id !== commentId);
      this.novelCommentsSubject.next(updatedNovelComments);
    });
  }

  private async startHubConnection() {
    try {
      await this.hubConnection.start();
      console.log('SignalR connection established');
    } catch (err) {
      console.error('Error establishing SignalR connection:', err);
      // Retry connection after 5 seconds
      setTimeout(() => this.startHubConnection(), 5000);
    }
  }

  // МЕТОДЫ ДЛЯ КОММЕНТАРИЕВ К ГЛАВАМ
  
  getChapterComments(chapterId: number): Observable<ChapterComment[]> {
    return this.http.get<ChapterComment[]>(`${this.apiUrl}/api/Comment/get-chapter-comment/${chapterId}`)
      .pipe(
        tap(comments => {
          // Исправляем несоответствие полей likes/likesCount
          const processedComments = comments.map(comment => {
            if (comment.likesCount !== undefined && comment.likes === undefined) {
              return { ...comment, likes: comment.likesCount };
            }
            return comment;
          });
          this.chapterCommentsSubject.next(processedComments);
          this.joinChapterGroup(chapterId);
        })
      );
  }

  sendComment(userId: number, chapterId: number, comment: CreateChapterCommentDto): Observable<ChapterComment> {
    // Get the token from localStorage for authorization
    const token = localStorage.getItem('token');
    
    // Create headers with Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('No authentication token found');
      return throwError(() => new Error('Authentication required'));
    }

    return this.http.post<ChapterComment>(
      `${this.apiUrl}/api/Comment/send-chapter-comment/${userId}/${chapterId}`, 
      comment,
      { headers }
    ).pipe(
      tap(newComment => {
        const currentComments = this.chapterCommentsSubject.value;
        this.chapterCommentsSubject.next([...currentComments, newComment]);
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  toggleCommentLike(commentId: number, userId: number): Observable<boolean> {
    return this.http.post<boolean>(
      `${this.apiUrl}/api/Comment/set-chapter-comment-like/${commentId}/${userId}`, 
      {}
    ).pipe(
      tap(() => {
        this.getCommentLikes(commentId).subscribe();
      })
    );
  }

  getCommentLikes(commentId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/api/Comment/get-chapter-comment-like/${commentId}`);
  }

  hasUserLikedComment(commentId: number, userId: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/api/Comment/has-user-liked-chapter-comment/${commentId}/${userId}`
    );
  }

  deleteComment(commentId: number, chapterId: number, userId: number): Observable<any> {
    // Get the token from localStorage for authorization
    const token = localStorage.getItem('token');
    
    // Create headers with Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('No authentication token found');
      return throwError(() => new Error('Authentication required'));
    }

    const url = `${this.apiUrl}/api/Comment/delete-chapter-comments/${commentId}/${chapterId}/${userId}`;

    return this.http.delete<any>(url, { headers }).pipe(
      tap(response => {
        // Update the comments list by removing the deleted comment
        const currentComments = this.chapterCommentsSubject.value;
        const updatedComments = currentComments.filter(comment => comment.id !== commentId);
        this.chapterCommentsSubject.next(updatedComments);
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  private joinChapterGroup(chapterId: number): void {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinChapterGroup', chapterId)
        .catch(err => console.error('Error joining chapter group:', err));
    }
  }

  // МЕТОДЫ ДЛЯ КОММЕНТАРИЕВ К НОВЕЛЛАМ
  
  getNovelComments(novelId: number): Observable<NovelComment[]> {
    return this.http.get<NovelComment[]>(`${this.apiUrl}/api/Comment/get-novel-comment/${novelId}`)
      .pipe(
        tap(comments => {
          // Исправляем несоответствие полей likes/likesCount
          const processedComments = comments.map(comment => {
            if (comment.likesCount !== undefined && comment.likes === undefined) {
              return { ...comment, likes: comment.likesCount };
            }
            return comment;
          });
          this.novelCommentsSubject.next(processedComments);
          this.joinNovelGroup(novelId);
        })
      );
  }

  sendNovelComment(userId: number, novelId: number, comment: CreateNovelCommentDto): Observable<NovelComment> {
    // Get the token from localStorage for authorization
    const token = localStorage.getItem('token');
    
    // Create headers with Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('No authentication token found');
      return throwError(() => new Error('Authentication required'));
    }

    return this.http.post<NovelComment>(
      `${this.apiUrl}/api/Comment/send-novel-comment/${userId}/${novelId}`, 
      comment,
      { headers }
    ).pipe(
      tap(newComment => {
        const currentComments = this.novelCommentsSubject.value;
        this.novelCommentsSubject.next([...currentComments, newComment]);
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  toggleNovelCommentLike(commentId: number, userId: number): Observable<number> {
    return this.http.post<number>(
      `${this.apiUrl}/api/Comment/set-novel-comment-like/${commentId}/${userId}`, 
      {}
    ).pipe(
      switchMap(() => this.getNovelCommentLikes(commentId))
    );
  }

  getNovelCommentLikes(commentId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/api/Comment/get-novel-comment-like/${commentId}`);
  }

  hasUserLikedNovelComment(commentId: number, userId: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/api/Comment/has-user-liked-novel-comment/${commentId}/${userId}`
    );
  }

  deleteNovelComment(commentId: number, novelId: number, userId: number): Observable<any> {
    // Get the token from localStorage for authorization
    const token = localStorage.getItem('token');
    
    // Create headers with Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('No authentication token found');
      return throwError(() => new Error('Authentication required'));
    }

    const url = `${this.apiUrl}/api/Comment/delete-novel-comments/${commentId}/${novelId}/${userId}`;

    return this.http.delete<any>(url, { headers }).pipe(
      tap(response => {
        // Update the comments list by removing the deleted comment
        const currentComments = this.novelCommentsSubject.value;
        const updatedComments = currentComments.filter(comment => comment.id !== commentId);
        this.novelCommentsSubject.next(updatedComments);
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  private joinNovelGroup(novelId: number): void {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinNovelGroup', novelId)
        .catch(err => console.error('Error joining novel group:', err));
    }
  }

  public disconnect() {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .catch(err => console.error('Error stopping SignalR connection:', err));
    }
  }
} 