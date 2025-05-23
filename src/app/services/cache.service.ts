import { Injectable } from '@angular/core';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
    this.loadFromStorage();
    window.addEventListener('beforeunload', () => this.saveToStorage());
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if the cache entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl = this.DEFAULT_TTL): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }

  clear(keyPattern?: string): void {
    if (keyPattern) {
      const regex = new RegExp(keyPattern);
      this.cache.forEach((_, key) => {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      });
    } else {
      this.cache.clear();
    }
  }

  private loadFromStorage(): void {
    try {
      const cached = localStorage.getItem('novel_cache');
      if (cached) {
        const entries = JSON.parse(cached);
        entries.forEach(([key, entry]: [string, CacheEntry<any>]) => {
          this.cache.set(key, entry);
        });
        
        // Clear expired entries
        this.cleanExpiredEntries();
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
      localStorage.removeItem('novel_cache');
    }
  }

  private saveToStorage(): void {
    try {
      this.cleanExpiredEntries();
      const entries = Array.from(this.cache.entries());
      localStorage.setItem('novel_cache', JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  private cleanExpiredEntries(): void {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    });
  }
} 