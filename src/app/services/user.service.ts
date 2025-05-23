import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, of, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: number;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  roleId: number;
  roleName?: string;
  imageUrl?: string;
  memberSince?: Date;
  createdAt?: string; // Backend might return this instead of memberSince
  hasNewChapters?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  public readonly API_URL = `${environment.apiUrl}/api`;
  private readonly IMAGE_CACHE_PREFIX = 'user_image_';
  private readonly IMAGE_CACHE_TIMESTAMP = 'user_image_timestamp_';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getCurrentUserProfile(): Observable<UserProfile> {
    const userId = this.getUserIdFromToken();
    return this.getUserProfile(userId);
  }

  getUserProfile(userId: number): Observable<UserProfile> {
    // Include the role information in the request headers
    const token = localStorage.getItem('token');
    const options = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    
    return this.http.get<UserProfile>(`${this.API_URL}/User/get-user/${userId}`, options)
      .pipe(
        catchError((error) => {
          if (error.status === 401 || error.status === 403) {
            // If unauthorized, try to refresh the token/user data
            localStorage.removeItem('currentUser'); // Force re-fetch user data
            return this.authService.refreshUserData().pipe(
              catchError(err => {
                return throwError(() => ({
                  message: 'Your session has expired. Please log in again.',
                  originalError: error
                }));
              })
            );
          }
          
          return this.handleError(error);
        })
      );
  }

  updateUserProfile(userId: number, userData: Partial<UserProfile>): Observable<any> {
    // Make sure roleId is properly formatted for the API
    const formattedData = {...userData};
    if (formattedData.roleId === undefined && this.authService.currentUserValue?.roleId) {
      // If roleId is missing from the update data, use the one from current user
      formattedData.roleId = this.authService.currentUserValue.roleId;
    }
    
    // Ensure all property names match what the backend expects (with first letter capitalized)
    const apiFormattedData = {
      UserName: formattedData.userName,
      Email: formattedData.email,
      FirstName: formattedData.firstName,
      LastName: formattedData.lastName,
      IsAdult: true,
      RoleId: formattedData.roleId || 0
    };
    
    // Get token for authorization
    const token = localStorage.getItem('token');
    const options = token ? { 
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'text' as 'json'
    } : { responseType: 'text' as 'json' };
    
    return this.http.put(`${this.API_URL}/User/update/${userId}`, apiFormattedData, options)
      .pipe(
        catchError(this.handleError)
      );
  }

  uploadProfileImage(userId: number, imageFile: File): Observable<any> {
    const formData = new FormData();
    // Make sure the field name exactly matches what the backend expects
    formData.append('imageFiles', imageFile);
    
    // Get authorization token but WITHOUT setting Content-Type header
    // Angular will automatically set the correct Content-Type with boundary for multipart/form-data
    const token = localStorage.getItem('token');
    const options = token ? { 
      headers: { 
        Authorization: `Bearer ${token}`
      },
      responseType: 'text' as 'json',
      // Prevent HttpClient from trying to handle Content-Type itself
      reportProgress: true
    } : { responseType: 'text' as 'json', reportProgress: true };
    
    return this.http.post(`${this.API_URL}/Image/add-user-image/${userId}`, formData, options)
      .pipe(
        tap(() => {
          // Clear cached image after successful upload to force fresh fetch
          this.clearCachedProfileImage(userId);
        }),
        catchError(this.handleError)
      );
  }

  getProfileImageUrl(userId: number, timestamp?: number): string {
    if (!userId) {
      return `assets/images/default-avatar.png?t=${timestamp || Date.now()}`;
    }
    return `${this.API_URL}/Image/get-user-image/${userId}?t=${timestamp || Date.now()}`;
  }

  getProfileImageWithCache(userId: number): Observable<string> {
    // First check if we have a cached version in localStorage
    const cachedImage = this.getCachedProfileImage(userId);
    if (cachedImage) {
      // Return cached image immediately
      const cachedImageObs = of(cachedImage);
      
      // Check if cache is stale (older than 1 hour)
      const timestamp = this.getCachedProfileImageTimestamp(userId);
      const oneHourAgo = Date.now() - 3600000;
      
      if (!timestamp || timestamp < oneHourAgo) {
        // Fetch fresh image in background
        this.fetchAndCacheProfileImage(userId).subscribe();
      }
      
      return cachedImageObs;
    } else {
      // No cached image, fetch from server and cache it
      return this.fetchAndCacheProfileImage(userId);
    }
  }

  private fetchAndCacheProfileImage(userId: number): Observable<string> {
    const token = localStorage.getItem('token');
    const options = token ? { 
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob' as 'json'
    } : { responseType: 'blob' as 'json' };

    const imageUrl = this.getProfileImageUrl(userId);
    
    return new Observable<string>(observer => {
      this.http.get(imageUrl, options).subscribe({
        next: (blob: any) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            // Cache the image in localStorage
            this.cacheProfileImage(userId, base64data);
            observer.next(base64data);
            observer.complete();
          };
          reader.readAsDataURL(blob);
        },
        error: (error) => {
          // If error, return default image path
          const defaultImage = `assets/images/default-avatar.png?t=${Date.now()}`;
          observer.next(defaultImage);
          observer.complete();
        }
      });
    });
  }

  private cacheProfileImage(userId: number, base64Image: string): void {
    try {
      localStorage.setItem(this.IMAGE_CACHE_PREFIX + userId, base64Image);
      localStorage.setItem(this.IMAGE_CACHE_TIMESTAMP + userId, Date.now().toString());
    } catch (e) {
      // If localStorage is full, clear old images
      this.clearOldImageCache();
      try {
        // Try again after clearing
        localStorage.setItem(this.IMAGE_CACHE_PREFIX + userId, base64Image);
        localStorage.setItem(this.IMAGE_CACHE_TIMESTAMP + userId, Date.now().toString());
      } catch (e) {
        // Failed to cache
      }
    }
  }

  private getCachedProfileImage(userId: number): string | null {
    return localStorage.getItem(this.IMAGE_CACHE_PREFIX + userId);
  }

  private getCachedProfileImageTimestamp(userId: number): number | null {
    const timestamp = localStorage.getItem(this.IMAGE_CACHE_TIMESTAMP + userId);
    return timestamp ? parseInt(timestamp) : null;
  }

  private clearCachedProfileImage(userId: number): void {
    localStorage.removeItem(this.IMAGE_CACHE_PREFIX + userId);
    localStorage.removeItem(this.IMAGE_CACHE_TIMESTAMP + userId);
  }

  private clearOldImageCache(): void {
    // Find all image-related items
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.IMAGE_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
      if (key && key.startsWith(this.IMAGE_CACHE_TIMESTAMP)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all found keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private getUserIdFromToken(): number {
    const user = this.authService.currentUserValue;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    if (!user.id) {
      // We'll still throw the error to be handled by the caller
      // The profile component will catch this and attempt a refresh
      throw new Error('User ID not available');
    }
    
    return user.id;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Server is unreachable. Please check your internet connection';
      } else if (error.status === 401) {
        errorMessage = 'You need to log in again to access this resource';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to access this resource';
      } else if (error.status === 404) {
        errorMessage = 'User profile not found';
      } else if (error.error && typeof error.error === 'object') {
        errorMessage = error.error.message || errorMessage;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      }
    }
    
    return throwError(() => ({ message: errorMessage, originalError: error }));
  }

  clearNewChaptersNotification(userId: number): Observable<any> {
    const token = localStorage.getItem('token');
    const options = token ? { 
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'text' as 'json'
    } : { responseType: 'text' as 'json' };
    
    return this.http.post(`${this.API_URL}/User/clear-new-chapters/${userId}`, {}, options)
      .pipe(
        catchError(this.handleError)
      );
  }
} 