import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { NovelService, NovelFilterOptions, Genre } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription, filter, finalize, of, catchError } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface StatusOption {
  value: number;
  label: string;
}

interface NovelApiResponse {
  novels: Novel[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
  pageSize: number;
}

@Component({
  selector: 'app-browse',
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.css']
})
export class BrowseComponent implements OnInit, OnDestroy {
  novels: Novel[] = [];
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalItems = 0;
  allPagesLoaded = false;
  loadingMore = false;
  
  // Filter and sort options
  filters: NovelFilterOptions = {
    pageNumber: 1,
    pageSize: 20
  };
  
  genres: Genre[] = [];
  
  statuses: StatusOption[] = [
    { value: NovelStatus.InProgress, label: 'In Progress' },
    { value: NovelStatus.Completed, label: 'Completed' },
    { value: NovelStatus.Frozen, label: 'Frozen' },
    { value: NovelStatus.Abandoned, label: 'Abandoned' }
  ];
  
  private routerSubscription: Subscription | null = null;
  private queryParamsSubscription: Subscription | null = null;
  loading = false;
  error: string | null = null;
  loadingGenres = false;
  maxVisiblePages = 10;
  isOffline = false;
  forceRefresh = false;

  constructor(
    private novelService: NovelService,
    private authService: AuthService,
    private libraryService: LibraryService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOffline = false;
      if (this.forceRefresh) {
        this.refreshData();
      }
    });
    
    window.addEventListener('offline', () => {
      this.isOffline = true;
    });
    
    // Check initial network status
    this.isOffline = !navigator.onLine;
  }

  ngOnInit(): void {
    // Load genres from API
    this.loadGenres();
    
    // Subscribe to query parameter changes
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      // Parse filter parameters
      if (params['genreId']) {
        this.filters.genreId = Number(params['genreId']);
      } else {
        this.filters.genreId = undefined;
      }
      
      if (params['status']) {
        this.filters.status = Number(params['status']);
      } else {
        this.filters.status = undefined;
      }
      
      if (params['sortBy']) {
        this.filters.sortBy = params['sortBy'] as 'popular' | 'rating' | 'newest' | 'a-z';
      } else {
        this.filters.sortBy = undefined;
      }
      
      // Reset pagination and load first page
      this.currentPage = 1;
      this.filters.pageNumber = 1;
      this.novels = [];
      this.allPagesLoaded = false;
      
      // Only call API if this is not initial page load with empty params
      if (Object.keys(params).length > 0 || this.forceRefresh) {
        this.loadNovels(false);
      } else {
        this.loadNovels(false);
      }
    });

    // Subscribe to navigation end events
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // After navigation completes, sync state with URL
        this.syncStateWithUrl();
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions when component is destroyed
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    
    // Remove event listeners
    window.removeEventListener('online', () => {
      this.isOffline = false;
    });
    
    window.removeEventListener('offline', () => {
      this.isOffline = true;
    });
  }

  // Detect when user scrolls near bottom of page
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (this.loading || this.loadingMore || this.allPagesLoaded) {
      return;
    }
    
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const windowHeight = window.innerHeight;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    
    // Load more when user scrolls to 70% of page
    if (scrollPosition + windowHeight > documentHeight * 0.7) {
      this.loadMoreNovels();
    }
  }

  // Sync component state with URL
  syncStateWithUrl(): void {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Parse filter parameters
    const genreIdParam = urlParams.get('genreId');
    this.filters.genreId = genreIdParam ? Number(genreIdParam) : undefined;
    
    const statusParam = urlParams.get('status');
    this.filters.status = statusParam ? Number(statusParam) : undefined;
    
    const sortByParam = urlParams.get('sortBy');
    this.filters.sortBy = sortByParam as 'popular' | 'rating' | 'newest' | 'a-z' | undefined;
  }

  loadGenres(): void {
    this.loadingGenres = true;
    this.novelService.getAllGenres().subscribe({
      next: (genres) => {
        this.genres = genres;
        this.loadingGenres = false;
      },
      error: (err) => {
        console.error('Error loading genres:', err);
        this.loadingGenres = false;
      }
    });
  }

  loadNovels(append: boolean = false): void {
    if (!append) {
      this.loading = true;
    } else {
      this.loadingMore = true;
    }
    this.error = null;

    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    this.filters.userId = userId;

    // Pass filters to the service
    this.novelService.getNovels(this.filters)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.loadingMore = false;
        }),
        catchError(error => {
          console.error('Error loading novels:', error);
          
          if (this.isOffline) {
            this.error = 'You are currently offline. Some content may not be up to date.';
          } else if (error.status === 404) {
            this.error = 'No novels found matching your criteria.';
          } else {
            this.error = 'Failed to load novels. Please try again later.';
          }
          
          return of({
            novels: [],
            totalPages: 0,
            totalItems: 0,
            currentPage: this.filters.pageNumber || 1,
            pageSize: this.filters.pageSize || 20
          });
        })
      )
      .subscribe({
        next: (response: NovelApiResponse) => {
          // Set the image URL for each novel
          const loadedNovels = response.novels.map(novel => {
            if (novel.id) {
              novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            }
            return novel;
          });
          
          // Update novels array (append or replace)
          if (append) {
            this.novels = [...this.novels, ...loadedNovels];
          } else {
            this.novels = loadedNovels;
          }
          
          // Set pagination data from API response
          this.totalPages = response.totalPages;
          this.totalItems = response.totalItems;
          this.currentPage = response.currentPage;
          this.pageSize = response.pageSize;
          
          // Check if all pages are loaded
          this.allPagesLoaded = this.currentPage >= this.totalPages;
          
          // Check reading progress if user is authenticated and there are books
          if (userId && loadedNovels.length > 0) {
            this.checkLastReadChapters(userId);
          }
        }
      });
  }
  
  loadMoreNovels(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.filters.pageNumber = this.currentPage;
      this.loadNovels(true);
    }
  }
  
  checkLastReadChapters(userId: number): void {
    this.libraryService.getUserLibrary(userId).subscribe({
      next: (libraryEntries) => {
        if (!libraryEntries || libraryEntries.length === 0) return;
        
        // Update reading progress info for novels
        this.novels.forEach(novel => {
          if (novel.id) {
            const entry = libraryEntries.find(lib => lib.novelId === novel.id);
            if (entry) {
              let lastChapter = null;
              
              // Check object structure (C# uses PascalCase, JS uses camelCase)
              if (entry.LastReadChapter !== undefined) {
                lastChapter = entry.LastReadChapter;
              } else if (entry.lastReadChapter !== undefined) {
                lastChapter = entry.lastReadChapter;
              }
              
              // Only set if it's a valid chapter number
              if (lastChapter !== null && lastChapter > 0) {
                novel.currentChapter = lastChapter;
              }
            }
          }
        });
      },
      error: (err) => {
        console.error('Error checking last read chapters:', err);
      }
    });
  }

  applyFilters(): void {
    // Reset to page 1 when filters change
    this.currentPage = 1;
    this.filters.pageNumber = 1;
    this.novels = [];
    this.allPagesLoaded = false;
    
    // Update URL with filter parameters
    this.updateUrlWithFilters();
    
    // Load novels with new filters
    this.loadNovels(false);
  }
  
  clearFilters(): void {
    // Reset all filters
    this.filters = {
      pageNumber: 1,
      pageSize: this.pageSize,
      userId: this.authService.currentUserValue?.id || 0
    };
    
    // Reset page
    this.currentPage = 1;
    this.novels = [];
    this.allPagesLoaded = false;
    
    // Update URL and reload
    this.updateUrlWithFilters();
    this.loadNovels(false);
  }
  
  hasActiveFilters(): boolean {
    return this.filters.genreId !== undefined || 
           this.filters.status !== undefined || 
           this.filters.sortBy !== undefined;
  }

  updateUrlWithFilters(): void {
    // Build query params object
    const queryParams: any = {};
    
    // Add filter parameters if defined
    if (this.filters.genreId !== undefined) {
      queryParams.genreId = this.filters.genreId;
    }
    
    if (this.filters.status !== undefined) {
      queryParams.status = this.filters.status;
    }
    
    if (this.filters.sortBy !== undefined) {
      queryParams.sortBy = this.filters.sortBy;
    }
    
    // Update URL without reloading page
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge', // keep other params
      replaceUrl: false // add new entry to browser history
    });
  }

  getPageNumbers(): number[] {
    if (this.totalPages <= this.maxVisiblePages) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }
    
    // Show maximum 10 page buttons with current page in the middle when possible
    let startPage = Math.max(1, this.currentPage - Math.floor(this.maxVisiblePages / 2));
    let endPage = startPage + this.maxVisiblePages - 1;
    
    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - this.maxVisiblePages + 1);
    }
    
    return Array.from({ length: (endPage - startPage) + 1 }, (_, i) => startPage + i);
  }

  // Listen for popstate event (browser back/forward button)
  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    // Small delay to allow URL to update
    setTimeout(() => {
      this.syncStateWithUrl();
    }, 0);
  }

  refreshData(): void {
    // Force refresh data by clearing cache and reloading
    this.forceRefresh = true;
    
    // Clear related caches
    const cachePattern = 'novels_page';
    this.novelService.clearCache(cachePattern);
    
    // Reset pagination
    this.currentPage = 1;
    this.filters.pageNumber = 1;
    this.novels = [];
    this.allPagesLoaded = false;
    
    // Reload data
    this.loadNovels(false);
    
    // Reset the force refresh flag
    this.forceRefresh = false;
  }
}
