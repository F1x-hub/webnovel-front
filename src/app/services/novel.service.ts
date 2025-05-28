import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
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
  title: string;
  content: string;
  chapterNumber: number;
  pdfPath?: string;
  usePdfContent?: boolean;
}

export interface Chapter {
  id?: number;
  novelId?: number;
  chapterNumber: number;
  title: string;
  content: string;
  pdfPath?: string;
  usePdfContent?: boolean;
  createdAt?: Date;
  isRead?: boolean;
}

export interface GetChapterDto {
  id: number;
  novelId: number;
  chapterNumber: number;
  title: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
  pdfPath?: string;
  usePdfContent?: boolean;
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
  private readonly DATA_CACHE_PREFIX = 'novel_data_';
  private readonly POPULAR_CACHE_KEY = 'most_popular_last_week';
  private readonly RATED_CACHE_KEY = 'novels_by_rating';
  private readonly IMAGE_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DATA_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_COVER_IMAGE = 'assets/images/default-cover.png';

  constructor(private http: HttpClient) {}

  getNovels(options: NovelFilterOptions = {}): Observable<NovelApiResponse> {
    const { pageNumber = 1, pageSize = 10, genreId, status, sortBy, userId = 0 } = options;
    const cacheKey = `${this.DATA_CACHE_PREFIX}novels_page${pageNumber}_size${pageSize}_genre${genreId || 'null'}_status${status || 'null'}_sort${sortBy || 'null'}_user${userId}`;
    
    const cached = this.getFromCache<NovelApiResponse>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
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
        tap(response => {
          if (response.novels?.length) {
            // Add image URLs to novels
            response.novels.forEach(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
            });
            this.saveToCache(cacheKey, response);
          }
        }),
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
    const cacheKey = `${this.DATA_CACHE_PREFIX}novel_${id}_user${userId}`;
    
    const cached = this.getFromCache<Novel>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<Novel>(`${this.apiUrl}/api/Novel/get-novel/${id}?userId=${userId}`)
      .pipe(
        tap(novel => {
          if (novel && novel.id) {
            novel.imageUrl = this.getNovelImageUrl(novel.id);
            this.saveToCache(cacheKey, novel);
          }
        })
      );
  }

  getUserNovels(userId: number, requestUserId: number = 0, options: NovelFilterOptions = {}): Observable<Novel[]> {
    const { genreId, status, sortBy } = options;
    const cacheKey = `${this.DATA_CACHE_PREFIX}user_novels_${userId}_req${requestUserId}_genre${genreId || 'null'}_status${status || 'null'}_sort${sortBy || 'null'}`;
    
    const cached = this.getFromCache<Novel[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
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
    
    return this.http.get<Novel[]>(url)
      .pipe(
        tap(novels => {
          if (novels?.length) {
            novels.forEach(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
            });
            this.saveToCache(cacheKey, novels);
          }
        })
      );
  }

  createNovel(novelData: CreateNovelDto, userId: number): Observable<Novel> {
    return this.http.post<Novel>(`${this.apiUrl}/api/Novel/create-novel/${userId}`, novelData)
      .pipe(
        tap(() => {
          this.clearDataCache();
        })
      );
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
        tap(() => {
          // Clear related data caches
          this.clearNovelDataCache(novelId);
          this.clearDataCacheByPattern(`${this.DATA_CACHE_PREFIX}user_novels_${userId}`);
          this.clearDataCacheByPattern(this.POPULAR_CACHE_KEY);
          this.clearDataCacheByPattern(this.RATED_CACHE_KEY);
        }),
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
    return this.http.delete<any>(`${this.apiUrl}/api/Novel/delete-novel/${novelId}/${userId}`)
      .pipe(
        tap(() => {
          // Clear all data caches on novel deletion
          this.clearDataCache();
        })
      );
  }
  
  createChapter(userId: number, novelId: number, chapterData: CreateChapterDto): Observable<GetChapterDto> {
    // Ensure content is not empty
    if (!chapterData.content || chapterData.content.trim().length === 0) {
      chapterData.content = "Content placeholder";
    }
    
    // Ensure we have a valid chapter number (even if it's 0 and backend will overwrite it)
    if (chapterData.chapterNumber === undefined || chapterData.chapterNumber === null) {
      chapterData.chapterNumber = 0;
    }
    
    return this.http.post<GetChapterDto>(`${this.apiUrl}/api/Chapter/create-chapter/${userId}/${novelId}`, chapterData)
      .pipe(
        tap(() => {
          // Clear novel data cache when a chapter is added
          this.clearNovelDataCache(novelId);
        })
      );
  }
  
  deleteChapter(novelId: number, chapterId: number, userId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/api/Chapter/delete-chapter/${novelId}/${chapterId}/${userId}`)
      .pipe(
        tap(() => {
          // Clear novel data cache when a chapter is deleted
          this.clearNovelDataCache(novelId);
        })
      );
  }

  updateChapter(novelId: number, chapterId: number, userId: number, chapterData: CreateChapterDto): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/Chapter/update-chapter/${novelId}/${chapterId}/${userId}`, chapterData)
      .pipe(
        tap(() => {
          // Clear novel data cache when a chapter is updated
          this.clearNovelDataCache(novelId);
        })
      );
  }
  
  getAllChapters(novelId: number): Observable<Chapter[]> {
    const cacheKey = `${this.DATA_CACHE_PREFIX}novel_${novelId}_chapters`;
    
    const cached = this.getFromCache<Chapter[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    // Only use the working endpoint
    return this.http.get<Chapter[]>(`${this.apiUrl}/api/Chapter/novel-all-chapters/${novelId}`)
      .pipe(
        tap(chapters => {
          if (chapters?.length) {
            this.saveToCache(cacheKey, chapters);
          }
        }),
        catchError(error => {
          // Return empty array on error
          return of([]);
        })
      );
  }

  getChapterByNumber(novelId: number, chapterNumber: number, userId: number = 0): Observable<GetChapterDto> {
    const cacheKey = `${this.DATA_CACHE_PREFIX}novel_${novelId}_chapter_${chapterNumber}_user${userId}`;
    
    const cached = this.getFromCache<GetChapterDto>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<GetChapterDto>(`${this.apiUrl}/api/Chapter/get-chapter/${novelId}/${chapterNumber}/${userId}`)
      .pipe(
        tap(chapter => {
          if (chapter) {
            this.saveToCache(cacheKey, chapter);
          }
        })
      );
  }

  uploadNovelImage(novelId: number, imageFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('imageFiles', imageFile);
    
    // Clear the cache for this novel as we're uploading a new image
    this.clearImageCache(novelId);
    
    return this.http.post<any>(`${this.apiUrl}/api/Image/add-novel-image/${novelId}`, formData)
      .pipe(
        tap(() => {
          // Clear novel data cache when the image is updated
          this.clearNovelDataCache(novelId);
        })
      );
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
      } else if (xhr.status === 406) {
        // Handle the case when the novel has no cover image (Not Acceptable)
        // Save the default image to cache to prevent future requests
        this.saveImageToCache(novelId, this.DEFAULT_COVER_IMAGE);
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
      // Collect all image cache keys with their timestamps
      const cacheItems = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.IMAGE_CACHE_PREFIX)) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsedItem = JSON.parse(item);
              cacheItems.push({
                key,
                timestamp: parsedItem.timestamp || 0
              });
            }
          } catch (e) {
            // If we can't parse it, add it with a zero timestamp so it gets removed
            cacheItems.push({
              key,
              timestamp: 0
            });
          }
        }
      }
      
      // Sort by timestamp, oldest first
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove the oldest ones up to count
      const toRemove = cacheItems.slice(0, count);
      toRemove.forEach(item => {
        localStorage.removeItem(item.key);
      });
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
    const cacheKey = `${this.DATA_CACHE_PREFIX}novel_${novelId}_rating`;
    
    const cached = this.getFromCache<RatingResponse>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<RatingResponse>(`${this.apiUrl}/api/Rating/get-novel-rating/${novelId}`)
      .pipe(
        tap(rating => {
          if (rating) {
            this.saveToCache(cacheKey, rating);
          }
        })
      );
  }

  getMostPopularLastWeek(limit: number = 10, userId: number = 0): Observable<Novel[]> {
    const cacheKey = `${this.POPULAR_CACHE_KEY}_limit${limit}_user${userId}`;
    
    const cached = this.getFromCache<Novel[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<Novel[]>(`${this.apiUrl}/api/Rating/most-popular-last-week?limit=${limit}&userId=${userId}`)
      .pipe(
        tap(novels => {
          if (novels?.length) {
            novels.forEach(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
            });
            this.saveToCache(cacheKey, novels);
          }
        }),
        catchError(error => {
          return of([]);
        })
      );
  }

  getNovelsByRating(limit: number = 10, userId: number = 0): Observable<Novel[]> {
    const cacheKey = `${this.RATED_CACHE_KEY}_limit${limit}_user${userId}`;
    
    const cached = this.getFromCache<Novel[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<Novel[]>(`${this.apiUrl}/api/Rating/by-rating?limit=${limit}&userId=${userId}`)
      .pipe(
        tap(novels => {
          if (novels?.length) {
            novels.forEach(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
            });
            this.saveToCache(cacheKey, novels);
          }
        }),
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
    ).pipe(
      tap(() => {
        // Clear novel rating and lists cache
        this.clearNovelDataCache(novelId);
        this.clearDataCacheByPattern(this.RATED_CACHE_KEY);
      })
    );
  }

  getNovelByName(name: string, userId: number = 0, options: NovelFilterOptions = {}): Observable<Novel[]> {
    const { genreId, status, sortBy, pageNumber = 1, pageSize = 10 } = options;
    const cacheKey = `${this.DATA_CACHE_PREFIX}novel_search_${name}_user${userId}_page${pageNumber}_size${pageSize}_genre${genreId || 'null'}_status${status || 'null'}_sort${sortBy || 'null'}`;
    
    const cached = this.getFromCache<Novel[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
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
    
    return this.http.get<Novel[]>(url)
      .pipe(
        tap(novels => {
          if (novels?.length) {
            novels.forEach(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
            });
            this.saveToCache(cacheKey, novels);
          }
        })
      );
  }

  getAllGenres(): Observable<Genre[]> {
    const cacheKey = `${this.DATA_CACHE_PREFIX}all_genres`;
    
    const cached = this.getFromCache<Genre[]>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<Genre[]>(`${this.apiUrl}/api/Genre/get-all-genre`)
      .pipe(
        tap(genres => {
          if (genres?.length) {
            this.saveToCache(cacheKey, genres, 60 * 60 * 1000); // Cache genres for 1 hour
          }
        })
      );
  }

  // Add a new method to upload PDF for a chapter
  uploadChapterPdf(userId: number, novelId: number, chapterId: number | null, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = chapterId !== null
      ? `${this.apiUrl}/api/Chapter/upload-pdf/${userId}/${novelId}/${chapterId}`
      : `${this.apiUrl}/api/Chapter/upload-pdf/${userId}/${novelId}`;
      
    return this.http.post<any>(url, formData)
      .pipe(
        tap(() => {
          // Clear chapter and novel caches
          if (chapterId) {
            this.clearDataCacheByPattern(`${this.DATA_CACHE_PREFIX}novel_${novelId}_chapter_`);
          }
          this.clearNovelDataCache(novelId);
        })
      );
  }

  // Replace an existing PDF file for a chapter
  replacePdf(userId: number, novelId: number, chapterId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<any>(`${this.apiUrl}/api/Chapter/replace-pdf/${userId}/${novelId}/${chapterId}`, formData)
      .pipe(
        tap(() => {
          // Clear chapter cache
          this.clearDataCacheByPattern(`${this.DATA_CACHE_PREFIX}novel_${novelId}_chapter_`);
        })
      );
  }

  // New data caching methods
  private saveToCache<T>(key: string, data: T, expiry: number = this.DATA_CACHE_EXPIRY): void {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expiry
      };
      
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      // If storage is full, clear some old items
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        this.clearOldestDataCache(5);
        try {
          // Try again after clearing
          const cacheItem = {
            data,
            timestamp: Date.now(),
            expiry
          };
          localStorage.setItem(key, JSON.stringify(cacheItem));
        } catch {
          // If still fails, give up
        }
      }
    }
  }
  
  private getFromCache<T>(key: string): T | null {
    try {
      const cacheItem = localStorage.getItem(key);
      if (!cacheItem) return null;
      
      const parsedCache = JSON.parse(cacheItem);
      
      // Check if cache is expired
      if (Date.now() - parsedCache.timestamp > (parsedCache.expiry || this.DATA_CACHE_EXPIRY)) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsedCache.data as T;
    } catch (error) {
      return null;
    }
  }
  
  private clearDataCache(): void {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.DATA_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      });
    } catch {
      // Ignore errors
    }
  }
  
  private clearNovelDataCache(novelId: number): void {
    this.clearDataCacheByPattern(`${this.DATA_CACHE_PREFIX}novel_${novelId}`);
  }
  
  private clearDataCacheByPattern(pattern: string): void {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(pattern)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore errors
        }
      });
    } catch {
      // Ignore errors
    }
  }
  
  private clearOldestDataCache(count: number): void {
    try {
      const cacheItems = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.DATA_CACHE_PREFIX)) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsedItem = JSON.parse(item);
              cacheItems.push({
                key,
                timestamp: parsedItem.timestamp || 0
              });
            }
          } catch {
            // If can't parse, add with zero timestamp
            cacheItems.push({
              key,
              timestamp: 0
            });
          }
        }
      }
      
      // Sort by timestamp, oldest first
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove the oldest ones up to count
      const toRemove = cacheItems.slice(0, count);
      toRemove.forEach(item => {
        localStorage.removeItem(item.key);
      });
    } catch {
      // Ignore errors
    }
  }

  // Method to clear cache when needed (e.g., after novel creation/update)
  clearCache(pattern?: string): void {
    if (pattern) {
      this.clearDataCacheByPattern(pattern);
    } else {
      this.clearDataCache();
      this.clearAllImageCache();
    }
  }

  /**
   * Get all novels with pagination - Admin specific method
   * This uses the same endpoint as getNovels but is specifically for admin usage
   */
  getAllNovelsAdmin(options: NovelFilterOptions = {}): Observable<NovelApiResponse> {
    const { pageNumber = 1, pageSize = 10, genreId, status, sortBy } = options;
    const cacheKey = `${this.DATA_CACHE_PREFIX}admin_novels_page${pageNumber}_size${pageSize}_genre${genreId || 'null'}_status${status || 'null'}_sort${sortBy || 'null'}`;
    
    const cached = this.getFromCache<NovelApiResponse>(cacheKey);
    if (cached) {
      return of(cached);
    }
    
    let url = `${this.apiUrl}/api/Novel/get-all-novels?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    
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
        tap(response => {
          // Enhance the novels with author information where available
          if (response.novels?.length) {
            response.novels = response.novels.map(novel => {
              if (novel.id) {
                novel.imageUrl = this.getNovelImageUrl(novel.id);
              }
              if (novel.authorId) {
                novel.authorName = novel.authorName || `User #${novel.authorId}`;
              }
              return novel;
            });
            
            this.saveToCache(cacheKey, response);
          }
        }),
        catchError(error => {
          if (error.status === 404) {
            return of({
              novels: [],
              totalPages: 0,
              totalItems: 0,
              currentPage: pageNumber,
              pageSize: pageSize
            });
          }
          throw error;
        })
      );
  }
} 