import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // This service has been temporarily disabled
} 