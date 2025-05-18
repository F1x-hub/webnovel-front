import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Novel } from '../components/novel-card/novel-card.component';
import { environment } from '../../environments/environment';

export interface NovelApiResponse {
  novels: Novel[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

export interface NovelFilterOptions {
  pageNumber?: number;
  pageSize?: number;
  genreId?: number;
  status?: number;
  sortBy?: 'popular' | 'rating' | 'newest' | 'a-z';
  userId?: number;
}

export interface CreateNovelDto {
  title: string;
  description: string;
  genreIds: number[];
  publishedDate?: string;
  status?: number;
  isAdultContent: boolean;
}

export interface UpdateNovelDto {
  title: string;
  description: string;
  status: number;
  views?: number;
  isAdultContent: boolean;
}

export interface CreateChapterDto {
  chapterNumber: number;
  title: string;
  content: string;
}

export interface Chapter {
  id: number;
  chapterNumber: number;
  title: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
}

export interface GetChapterDto {
  id: number;
  novelId: number;
  chapterNumber: number;
  title: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
}

export interface RatingResponse {
  novelId: number;
  averageRating: number;
  ratingsCount?: number;
}

export interface Genre {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class NovelService {
  private apiUrl = environment.apiUrl;
  private readonly IMAGE_CACHE_PREFIX = 'novel_cover_';
  private readonly IMAGE_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly DEFAULT_COVER_IMAGE = 'assets/images/default-cover.png';

  constructor(private http: HttpClient) {}

  getNovels(options: NovelFilterOptions = {}): Observable<NovelApiResponse> {
    const { pageNumber = 1, pageSize = 10, genreId, status, sortBy, userId = 0 } = options;
    let url = `${this.apiUrl}/api/Novel/get-all-novels?pageNumber=${pageNumber}&pageSize=${pageSize}&userId=${userId}`;
    
    if (genreId !== undefined) {
      url += `&genreId=${genreId}`;
    }
    
    if (status !== undefined) {
      url += `&status=${status}`;
    }
    
    if (sortBy) {
      url += `&sortBy=${sortBy}`;
    }
    
    return this.http.get<NovelApiResponse>(url)
      .pipe(
        catchError(error => {
          if (error.status === 404 && error.error === 'Novel not found.') {
            return of({
              novels: [],
              totalPages: 0,
              totalItems: 0,
              currentPage: pageNumber,
              pageSize: pageSize
            });
          }
          // For other errors, rethrow
          throw error;
        })
      );
  }
  
  getNovelById(id: number, userId: number = 0): Observable<Novel> {
    return this.http.get<Novel>(`${this.apiUrl}/api/Novel/get-novel/${id}?userId=${userId}`);
  }

  getUserNovels(userId: number, requestUserId: number = 0, options: NovelFilterOptions = {}): Observable<Novel[]> {
    const { genreId, status, sortBy } = options;
    let url = `${this.apiUrl}/api/Novel/get-all-user-novel/${userId}?requestUserId=${requestUserId}`;
    
    if (genreId !== undefined) {
      url += `&genreId=${genreId}`;
    }
    
    if (status !== undefined) {
      url += `&status=${status}`;
    }
    
    if (sortBy) {
      url += `&sortBy=${sortBy}`;
    }
    
    return this.http.get<Novel[]>(url);
  }

  createNovel(novelData: CreateNovelDto, userId: number): Observable<Novel> {
    return this.http.post<Novel>(`${this.apiUrl}/api/Novel/create-novel/${userId}`, novelData);
  }

  updateNovel(novelId: number, userId: number, novelData: UpdateNovelDto): Observable<any> {
    // Clear image cache when novel is updated
    this.clearImageCache(novelId);
    
    // Ensure data is properly formatted according to API expectations
    const formattedData = {
      title: novelData.title,
      description: novelData.description,
      status: Number(novelData.status),
      isAdultContent: Boolean(novelData.isAdultContent)
    };
    
    return this.http.put(`${this.apiUrl}/api/Novel/update-novel/${novelId}/${userId}`, formattedData, { 
      responseType: 'text',
      headers: { 'Content-Type': 'application/json' }
    })
      .pipe(
        catchError(error => {
          let errorMessage = 'Failed to update novel';
          if (error.error && typeof error.error === 'string') {
            try {
              // Try to parse error if it's JSON
              const errorObj = JSON.parse(error.error);
              errorMessage = errorObj.message || errorObj.title || JSON.stringify(errorObj);
            } catch {
              // If it's not JSON, use the error text directly
              errorMessage = error.error;
            }
          }
          throw new Error(errorMessage);
        })
      );
  }

  deleteNovel(novelId: number, userId: number): Observable<any> {
    // Clear image cache when novel is deleted
    this.clearImageCache(novelId);
    return this.http.delete<any>(`${this.apiUrl}/api/Novel/delete-novel/${novelId}/${userId}`);
  }
  
  createChapter(userId: number, novelId: number, chapterData: CreateChapterDto): Observable<GetChapterDto> {
    return this.http.post<GetChapterDto>(`${this.apiUrl}/api/Chapter/create-chapter/${userId}/${novelId}`, chapterData);
  }
  
  deleteChapter(novelId: number, chapterId: number, userId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/Chapter/delete-chapter/${novelId}/${chapterId}/${userId}`);
  }
  
  getAllChapters(novelId: number): Observable<Chapter[]> {
    // Try the new endpoint first
    return this.http.get<Chapter[]>(`${this.apiUrl}/api/Chapter/novel-chapters-direct/${novelId}`)
      .pipe(
        catchError(directError => {
          // If the direct endpoint fails, fall back to the original endpoint
          return this.http.get<Chapter[]>(`${this.apiUrl}/api/Chapter/novel-all-chapters/${novelId}`)
            .pipe(
              catchError(error => {
                return of([]);
              })
            );
        })
      );
  }

  getChapterByNumber(novelId: number, chapterNumber: number, userId: number = 0): Observable<GetChapterDto> {
    return this.http.get<GetChapterDto>(`${this.apiUrl}/api/Chapter/get-chapter/${novelId}/${chapterNumber}/${userId}`);
  }

  uploadNovelImage(novelId: number, imageFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('imageFiles', imageFile);
    
    // Clear the cache for this novel as we're uploading a new image
    this.clearImageCache(novelId);
    
    return this.http.post<any>(`${this.apiUrl}/api/Image/add-novel-image/${novelId}`, formData);
  }

  getNovelImageUrl(novelId: number): string {
    // If no novel ID, return default image
    if (!novelId) {
      return this.DEFAULT_COVER_IMAGE;
    }
    
    const cachedImage = this.getImageFromCache(novelId);
    if (cachedImage) {
      return cachedImage.dataUrl;
    }
    
    // No cache or expired, return the API URL
    const imageUrl = `${this.apiUrl}/api/Image/get-novel-image/${novelId}?t=${new Date().getTime()}`;
    
    // Fetch and cache the image
    this.fetchAndCacheImage(novelId, imageUrl);
    
    return imageUrl;
  }

  private fetchAndCacheImage(novelId: number, imageUrl: string): void {
    // Skip if we're in a server-side rendering context
    if (typeof window === 'undefined') return;

    // Проверим, достаточно ли места в localStorage
    try {
      // Если место в localStorage заканчивается, очистим старые элементы
      if (localStorage.length > 20) {
        this.clearOldestCachedImages(5);
      }
    } catch (e) {
      // Suppressing error logging
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', imageUrl, true);
    xhr.responseType = 'blob';
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const blob = xhr.response;
        
        // Если размер изображения больше 1MB, не сохраняем в кэш
        if (blob.size > 1024 * 1024) {
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          this.saveImageToCache(novelId, dataUrl);
        };
        reader.readAsDataURL(blob);
      }
    };
    
    xhr.onerror = () => {
      // Suppressing error logging
    };
    
    xhr.send();
  }

  private saveImageToCache(novelId: number, dataUrl: string): void {
    try {
      // Перед сохранением проверим размер данных
      const estimatedSize = dataUrl.length * 2; // примерная оценка размера в байтах
      
      // Если изображение слишком большое (>1MB), не кэшируем его
      if (estimatedSize > 1024 * 1024) {
        return;
      }

      // Пытаемся очистить место, если нужно
      this.cleanupCacheIfNeeded();
      
      const cacheItem = {
        dataUrl,
        timestamp: Date.now()
      };
      
      localStorage.setItem(`${this.IMAGE_CACHE_PREFIX}${novelId}`, JSON.stringify(cacheItem));
    } catch (error) {
      // При ошибке квоты, очищаем кэш изображений
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        this.clearOldestCachedImages(5); // Удаляем 5 самых старых кэшированных изображений
      }
    }
  }

  // Метод для очистки кэша при приближении к лимиту
  private cleanupCacheIfNeeded(): void {
    try {
      // Удаляем старые кэши, если в localStorage осталось мало места
      // Примерная оценка - если использовано более 80% от квоты
      const totalItems = localStorage.length;
      if (totalItems > 15) { // Если в хранилище много элементов
        this.clearOldestCachedImages(3); // Удаляем несколько самых старых
      }
    } catch (error) {
      // Suppressing error logging
    }
  }

  // Удаление самых старых кэшированных изображений
  private clearOldestCachedImages(count: number): void {
    try {
      const cacheItems: {key: string; timestamp: number}[] = [];
      
      // Собираем все кэшированные изображения с временными метками
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.IMAGE_CACHE_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item && item.timestamp) {
              cacheItems.push({key, timestamp: item.timestamp});
            }
          } catch (e) {
            // Если не удалось разобрать JSON, просто пропускаем этот элемент
          }
        }
      }
      
      // Сортируем по временной метке (от старых к новым)
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Удаляем самые старые
      const itemsToRemove = Math.min(count, cacheItems.length);
      for (let i = 0; i < itemsToRemove; i++) {
        localStorage.removeItem(cacheItems[i].key);
      }
    } catch (error) {
      // Suppressing error logging
    }
  }

  private getImageFromCache(novelId: number): { dataUrl: string, timestamp: number } | null {
    try {
      const cacheItem = localStorage.getItem(`${this.IMAGE_CACHE_PREFIX}${novelId}`);
      if (!cacheItem) return null;
      
      const parsedCache = JSON.parse(cacheItem);
      
      // Check if cache is expired
      if (Date.now() - parsedCache.timestamp > this.IMAGE_CACHE_EXPIRY) {
        this.clearImageCache(novelId);
        return null;
      }
      
      return parsedCache;
    } catch (error) {
      return null;
    }
  }

  private clearImageCache(novelId: number): void {
    try {
      localStorage.removeItem(`${this.IMAGE_CACHE_PREFIX}${novelId}`);
    } catch (error) {
      // Suppressing error logging
    }
  }

  clearAllImageCache(): void {
    try {
      const keysToRemove: string[] = [];
      
      // Сначала соберем все ключи, которые нужно удалить
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.IMAGE_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      // Затем удалим их
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Suppressing error logging
        }
      });
    } catch (error) {
      // Suppressing error logging
    }
  }

  getNovelRating(novelId: number): Observable<RatingResponse> {
    return this.http.get<RatingResponse>(`${this.apiUrl}/api/Rating/get-novel-rating/${novelId}`);
  }

  getMostPopularLastWeek(limit: number = 10, userId: number = 0): Observable<Novel[]> {
    return this.http.get<Novel[]>(`${this.apiUrl}/api/Rating/most-popular-last-week?limit=${limit}`)
      .pipe(
        catchError(error => {
          return of([]);
        })
      );
  }

  getNovelsByRating(limit: number = 10, userId: number = 0): Observable<Novel[]> {
    return this.http.get<Novel[]>(`${this.apiUrl}/api/Rating/by-rating?limit=${limit}&userId=${userId}`)
      .pipe(
        catchError(error => {
          return of([]);
        })
      );
  }

  rateNovel(novelId: number, userId: number, rating: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/Rating/rate-novel/${novelId}/${userId}`, 
      rating, 
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  getNovelByName(name: string, userId: number = 0, options: NovelFilterOptions = {}): Observable<Novel[]> {
    const { genreId, status, sortBy, pageNumber = 1, pageSize = 10 } = options;
    let url = `${this.apiUrl}/api/Novel/get-novel-by-name?name=${name}&userId=${userId}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
    
    if (genreId !== undefined) {
      url += `&genreId=${genreId}`;
    }
    
    if (status !== undefined) {
      url += `&status=${status}`;
    }
    
    if (sortBy) {
      url += `&sortBy=${sortBy}`;
    }
    
    return this.http.get<Novel[]>(url);
  }

  getAllGenres(): Observable<Genre[]> {
    return this.http.get<Genre[]>(`${this.apiUrl}/api/Genre/get-all-genre`);
  }
} 