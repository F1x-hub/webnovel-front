import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

// Define response interface
export interface ToggleReadResponse {
  success: boolean;
  lastReadChapter: number;
  isMarked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    // The Authorization header will be added by the interceptor
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  getUserLibrary(userId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/api/UserLibrary/user-library/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  isNovelInUserLibrary(userId: number, novelId: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/api/UserLibrary/check-novel/${userId}/${novelId}`,
      { headers: this.getHeaders() }
    );
  }

  toggleNovelInLibrary(userId: number, novelId: number): Observable<any> {
    // For POST with a primitive value, we need to stringify the number
    const body = JSON.stringify(0);
    return this.http.post(
      `${this.apiUrl}/api/UserLibrary/add-to-library/${userId}/${novelId}`, 
      body,
      { 
        headers: this.getHeaders(),
        responseType: 'text' 
      }
    );
  }

  getLastReadChapter(userId: number, novelId: number): Observable<number> {
    return this.http.get<any>(
      `${this.apiUrl}/api/Chapter/get-last-read/${userId}/${novelId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.lastReadChapter || 0)
    );
  }

  updateLastReadChapter(userId: number, novelId: number, chapterNumber: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/Chapter/update-last-read/${userId}/${novelId}/${chapterNumber}`,
      null,
      {
        headers: this.getHeaders(),
        responseType: 'text'
      }
    );
  }

  isCurrentReadChapter(userId: number, novelId: number, chapterNumber: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/api/Chapter/is-current-chapter/${userId}/${novelId}/${chapterNumber}`);
  }

  toggleLastReadChapter(userId: number, novelId: number, chapterNumber: number): Observable<ToggleReadResponse> {
    return this.http.post<ToggleReadResponse>(
      `${this.apiUrl}/api/Chapter/toggle-last-read/${userId}/${novelId}/${chapterNumber}`,
      null,
      { headers: this.getHeaders() }
    );
  }

  resetAddedChapter(userId: number, novelId: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/UserLibrary/reset-added-chapter/${userId}/${novelId}`,
      null,
      { 
        headers: this.getHeaders(),
        responseType: 'text' 
      }
    );
  }
} 