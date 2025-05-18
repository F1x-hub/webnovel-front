import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { NovelService, NovelFilterOptions, Genre } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription, filter, finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface StatusOption {
  value: number;
  label: string;
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
  
  // Filter and sort options
  filters: NovelFilterOptions = {
    pageNumber: 1,
    pageSize: 10
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

  constructor(
    private novelService: NovelService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    // Load genres from API
    this.loadGenres();
    
    // Subscribe to query parameter changes
    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      // Parse page parameter
      const page = Number(params['page']);
      if (page && !isNaN(page) && page > 0) {
        this.currentPage = page;
        this.filters.pageNumber = page;
      } else {
        this.currentPage = 1;
        this.filters.pageNumber = 1;
      }
      
      // Parse filter parameters
      if (params['genreId']) {
        this.filters.genreId = Number(params['genreId']);
      }
      
      if (params['status']) {
        this.filters.status = Number(params['status']);
      }
      
      if (params['sortBy']) {
        this.filters.sortBy = params['sortBy'] as 'popular' | 'rating' | 'newest' | 'a-z';
      }
      
      // Initialize totalPages, so it's not less than the current page
      this.totalPages = Math.max(this.totalPages, this.currentPage);
      
      this.loadNovels();
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
  }

  // Sync component state with URL
  syncStateWithUrl(): void {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Parse page parameter
    const pageParam = urlParams.get('page');
    if (pageParam) {
      const page = Number(pageParam);
      if (!isNaN(page) && page > 0) {
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.filters.pageNumber = page;
          
          // Force reload with updated params
          setTimeout(() => {
            this.loadNovels();
          }, 0);
        }
      }
    } else if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.filters.pageNumber = 1;
      this.loadNovels();
    }
    
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

  loadNovels(): void {
    this.loading = true;
    this.error = null;

    // Get current user ID if logged in
    const userId = this.authService.currentUserValue?.id || 0;
    this.filters.userId = userId;

    // Pass filters to the service
    this.novelService.getNovels(this.filters)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (data) => {
          // Set the image URL for each novel
          this.novels = data.map(novel => {
            if (novel.id) {
              novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            }
            return novel;
          });
          
          // Always ensure the current page is included in totalPages
          this.totalPages = Math.max(this.totalPages, this.currentPage);
          
          // If we received exactly pageSize novels, assume there are more pages
          if (data.length === this.pageSize) {
            this.totalPages = Math.max(this.totalPages, this.currentPage + 1);
          }
        },
        error: (err) => {
          console.error('Error loading novels:', err);
          
          // Check for specific error types
          if (err.status === 404) {
            this.error = 'No novels found matching your criteria.';
          } else {
            this.error = 'Failed to load novels. Please try again later.';
          }
        }
      });
  }

  applyFilters(): void {
    // Reset to page 1 when filters change
    this.currentPage = 1;
    this.filters.pageNumber = 1;
    
    // Update URL with filter parameters
    this.updateUrlWithFilters();
    
    // Load novels with new filters
    this.loadNovels();
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
    
    // Update URL and reload
    this.updateUrlWithFilters();
    this.loadNovels();
  }
  
  hasActiveFilters(): boolean {
    return this.filters.genreId !== undefined || 
           this.filters.status !== undefined || 
           this.filters.sortBy !== undefined;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.filters.pageNumber = page;
      this.updateUrlWithFilters();
      this.loadNovels();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.filters.pageNumber = this.currentPage;
      this.updateUrlWithFilters();
      this.loadNovels();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.filters.pageNumber = this.currentPage;
      this.updateUrlWithFilters();
      this.loadNovels();
    }
  }

  updateUrlWithFilters(): void {
    // Build query params object
    const queryParams: any = { page: this.currentPage };
    
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
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // Listen for popstate event (browser back/forward button)
  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    // Small delay to allow URL to update
    setTimeout(() => {
      this.syncStateWithUrl();
    }, 0);
  }
}
