import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NovelService, NovelFilterOptions, Genre } from '../../services/novel.service';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface StatusOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy {
  searchQuery: string = '';
  novels: Novel[] = [];
  loading: boolean = false;
  noResults: boolean = false;
  error: string | null = null;
  userId: number = 0;
  
  // Filter options
  filters: NovelFilterOptions = {
    pageNumber: 1,
    pageSize: 20
  };
  
  genres: Genre[] = [];
  loadingGenres: boolean = false;
  
  statuses: StatusOption[] = [
    { value: NovelStatus.InProgress, label: 'In Progress' },
    { value: NovelStatus.Completed, label: 'Completed' },
    { value: NovelStatus.Frozen, label: 'Frozen' },
    { value: NovelStatus.Abandoned, label: 'Abandoned' }
  ];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private novelService: NovelService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Load genres from API
    this.loadGenres();
    
    // Get user ID if logged in
    const authSub = this.authService.currentUser$.subscribe(user => {
      this.userId = user?.id || 0;
      this.filters.userId = this.userId;
    });
    this.subscriptions.push(authSub);

    // Subscribe to query parameter changes
    const querySub = this.route.queryParams.subscribe(params => {
      this.searchQuery = params['query'] || '';
      
      // Parse filter parameters if present
      if (params['genreId']) {
        this.filters.genreId = Number(params['genreId']);
      }
      
      if (params['status']) {
        this.filters.status = Number(params['status']);
      }
      
      if (params['sortBy']) {
        this.filters.sortBy = params['sortBy'] as 'popular' | 'rating' | 'newest' | 'a-z';
      }
      
      if (this.searchQuery) {
        this.searchNovels();
      }
    });
    this.subscriptions.push(querySub);
  }

  loadGenres(): void {
    this.loadingGenres = true;
    const genresSub = this.novelService.getAllGenres().subscribe({
      next: (genres) => {
        this.genres = genres;
        this.loadingGenres = false;
      },
      error: (err) => {
        console.error('Error loading genres:', err);
        this.loadingGenres = false;
      }
    });
    this.subscriptions.push(genresSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  searchNovels(): void {
    if (!this.searchQuery.trim()) {
      this.novels = [];
      this.noResults = false;
      return;
    }

    this.loading = true;
    this.error = null;
    this.filters.userId = this.userId;

    const searchSub = this.novelService.getNovelByName(this.searchQuery, this.userId, this.filters)
      .subscribe({
        next: (results) => {
          this.novels = results.map(novel => {
            if (novel.id) {
              novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            }
            return novel;
          });
          this.noResults = results.length === 0;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error searching novels:', err);
          this.error = 'An error occurred while searching for novels. Please try again.';
          this.loading = false;
          this.novels = [];
        }
      });
    
    this.subscriptions.push(searchSub);
  }

  onSearch(): void {
    // Update URL with search query and reset filters
    const queryParams: any = { query: this.searchQuery.trim() };
    
    // Add filter parameters if they exist
    if (this.filters.genreId !== undefined) {
      queryParams.genreId = this.filters.genreId;
    }
    
    if (this.filters.status !== undefined) {
      queryParams.status = this.filters.status;
    }
    
    if (this.filters.sortBy !== undefined) {
      queryParams.sortBy = this.filters.sortBy;
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams
    });

    this.searchNovels();
  }
  
  applyFilters(): void {
    this.onSearch(); // This will update URL and perform search
  }
  
  clearFilters(): void {
    this.filters = {
      pageNumber: 1,
      pageSize: 20,
      userId: this.userId
    };
    
    // Update URL with just the search query
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { query: this.searchQuery.trim() }
    });
    
    this.searchNovels();
  }
  
  hasActiveFilters(): boolean {
    return this.filters.genreId !== undefined || 
           this.filters.status !== undefined || 
           this.filters.sortBy !== undefined;
  }
}
