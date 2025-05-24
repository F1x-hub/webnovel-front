import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import * as signalR from '@microsoft/signalr';

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

export interface NovelComment {
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

export interface ChapterComment {
  id: number;
  displayName: string;
  content: string;
  publishedDate: string;
  likesCount: number;
  imageUrl?: string;
  isLiked?: boolean;
  userId?: number;
  chapterId?: number;
  novelId?: number;
  showOptions?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = environment.apiUrl;
  private hubConnection: signalR.HubConnection | null = null;
  private connectionIsEstablishing = false;
  
  // Subjects for real-time updates
  private novelCommentReceived = new Subject<NovelComment>();
  private chapterCommentReceived = new Subject<ChapterComment>();
  private commentDeleted = new Subject<number>();
  
  // Observable streams that components can subscribe to
  public novelComment$ = this.novelCommentReceived.asObservable();
  public chapterComment$ = this.chapterCommentReceived.asObservable();
  public commentDeleted$ = this.commentDeleted.asObservable();

  constructor(private http: HttpClient) {
    this.createConnection();
    this.startConnection();
  }

  private createConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/commentHub`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Retry with increasing delays
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }

  private startConnection(): void {
    if (!this.hubConnection || this.connectionIsEstablishing) return;

    this.connectionIsEstablishing = true;

    this.hubConnection
      .start()
      .then(() => {
        console.log('SignalR connection established');
        this.connectionIsEstablishing = false;
        this.registerSignalREvents();
      })
      .catch(err => {
        console.error('Error establishing SignalR connection:', err);
        this.connectionIsEstablishing = false;
        
        // Try to reconnect after 5 seconds, but only if not already establishing
        setTimeout(() => {
          if (!this.connectionIsEstablishing) {
            this.startConnection();
          }
        }, 5000);
      });
  }

  private registerSignalREvents(): void {
    if (!this.hubConnection) return;

    // Register for novel comment events
    this.hubConnection.on('ReceiveComment', (comment: NovelComment) => {
      console.log('Received novel comment:', comment);
      this.novelCommentReceived.next(comment);
    });

    // Register for chapter comment events
    this.hubConnection.on('ReceiveChapterComment', (comment: ChapterComment) => {
      console.log('Received chapter comment:', comment);
      this.chapterCommentReceived.next(comment);
    });

    // Register for comment deleted events
    this.hubConnection.on('CommentDeleted', (commentId: number) => {
      console.log('Comment deleted:', commentId);
      this.commentDeleted.next(commentId);
    });
  }

  // Method to stop the connection when service is destroyed
  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().catch(err => {
        console.error('Error stopping SignalR connection:', err);
      });
    }
  }

  // Novel comments API methods
  public getNovelComments(novelId: number): Observable<NovelComment[]> {
    return this.http.get<NovelComment[]>(`${this.apiUrl}/api/Comment/get-novel-comment/${novelId}`);
  }

  public sendNovelComment(userId: number, novelId: number, commentData: CreateNovelCommentDto): Observable<NovelComment> {
    return this.http.post<NovelComment>(
      `${this.apiUrl}/api/Comment/send-novel-comment/${userId}/${novelId}`,
      commentData
    );
  }

  public deleteNovelComment(commentId: number, novelId: number, userId: number): Observable<boolean> {
    return this.http.delete<boolean>(`${this.apiUrl}/api/Comment/delete-novel-comments/${commentId}/${novelId}/${userId}`);
  }

  public getNovelCommentLikes(commentId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/api/Comment/get-novel-comment-like/${commentId}`);
  }

  public hasUserLikedNovelComment(commentId: number, userId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/api/Comment/has-user-liked-novel-comment/${commentId}/${userId}`);
  }

  public toggleNovelCommentLike(commentId: number, userId: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/api/Comment/set-novel-comment-like/${commentId}/${userId}`, {});
  }

  // Chapter comments API methods
  public getChapterComments(chapterId: number): Observable<ChapterComment[]> {
    return this.http.get<ChapterComment[]>(`${this.apiUrl}/api/Comment/get-chapter-comment/${chapterId}`);
  }

  public sendChapterComment(userId: number, chapterId: number, commentData: CreateChapterCommentDto): Observable<ChapterComment> {
    return this.http.post<ChapterComment>(
      `${this.apiUrl}/api/Comment/send-chapter-comment/${userId}/${chapterId}`,
      commentData
    );
  }

  public deleteChapterComment(commentId: number, chapterId: number, userId: number): Observable<boolean> {
    return this.http.delete<boolean>(`${this.apiUrl}/api/Comment/delete-chapter-comments/${commentId}/${chapterId}/${userId}`);
  }

  public getChapterCommentLikes(commentId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/api/Comment/get-chapter-comment-like/${commentId}`);
  }

  public hasUserLikedChapterComment(commentId: number, userId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/api/Comment/has-user-liked-chapter-comment/${commentId}/${userId}`);
  }

  public toggleChapterCommentLike(commentId: number, userId: number): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/api/Comment/set-chapter-comment-like/${commentId}/${userId}`, {});
  }
} 