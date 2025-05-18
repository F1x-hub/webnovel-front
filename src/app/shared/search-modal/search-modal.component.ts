import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NovelService } from '../../services/novel.service';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html',
  styleUrls: ['./search-modal.component.css']
})
export class SearchModalComponent implements OnInit, OnDestroy {
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef;
  
  searchQuery: string = '';
  searchResults: Novel[] = [];
  isLoading: boolean = false;
  selectedIndex: number = -1;
  imagesLoaded: { [key: number]: boolean } = {};
  
  private searchQuerySubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  constructor(
    private novelService: NovelService,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Focus the search input when the modal opens
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 100);

    // Subscribe to search input changes for real-time search
    const searchSub = this.searchQuerySubject.pipe(
      debounceTime(300), // Wait for 300ms pause in events
      distinctUntilChanged() // Only emit if value changed
    ).subscribe(query => {
      this.performSearch(query);
    });
    
    this.subscriptions.push(searchSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Close modal when clicking outside
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectNextResult();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectPreviousResult();
    } else if (event.key === 'Enter') {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.searchResults.length) {
        this.navigateToNovel(this.searchResults[this.selectedIndex]);
      } else if (this.searchQuery.trim()) {
        this.navigateToSearchPage();
      }
    }
  }

  onSearchInput(): void {
    this.searchQuerySubject.next(this.searchQuery);
  }

  performSearch(query: string): void {
    if (!query.trim()) {
      this.searchResults = [];
      return;
    }

    this.isLoading = true;
    this.imagesLoaded = {};
    
    // Get current user ID if logged in, otherwise use 0 for anonymous
    const userId = this.authService.currentUserValue?.id || 0;
    console.log('Searching with userId:', userId, 'Query:', query);
    
    this.novelService.getNovelByName(query, userId).subscribe({
      next: (results) => {
        // Set image URLs for each result
        results.forEach(novel => {
          if (novel.id) {
            novel.imageUrl = this.novelService.getNovelImageUrl(novel.id);
            // Initialize image loading state
            this.imagesLoaded[novel.id] = false;
          }
        });
        
        this.searchResults = results; // Показывать все результаты
        console.log('Search results:', this.searchResults.length, 'total results');
        this.isLoading = false;
        this.selectedIndex = -1; // Reset selection
      },
      error: (err) => {
        console.error('Search error:', err);
        this.searchResults = [];
        this.isLoading = false;
      }
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'assets/images/default-cover.png';
      // Set image as loaded when using fallback
      const novelId = this.getNovelIdFromImgElement(img);
      if (novelId) {
        this.imagesLoaded[novelId] = true;
      }
    }
  }

  onImageLoad(novelId: number): void {
    if (novelId) {
      this.imagesLoaded[novelId] = true;
    }
  }

  private getNovelIdFromImgElement(img: HTMLImageElement): number | null {
    // Try to find the parent result-item and extract the novel id
    const resultItem = img.closest('.result-item');
    if (resultItem) {
      const index = Array.from(resultItem.parentElement?.children || []).indexOf(resultItem);
      if (index >= 0 && index < this.searchResults.length) {
        return this.searchResults[index].id || null;
      }
    }
    return null;
  }

  isImageLoaded(novelId: number | undefined): boolean {
    return novelId ? !!this.imagesLoaded[novelId] : false;
  }

  selectResult(index: number): void {
    this.selectedIndex = index;
  }

  selectNextResult(): void {
    if (this.searchResults.length > 0) {
      this.selectedIndex = (this.selectedIndex + 1) % this.searchResults.length;
    }
  }

  selectPreviousResult(): void {
    if (this.searchResults.length > 0) {
      this.selectedIndex = this.selectedIndex <= 0 ? 
        this.searchResults.length - 1 : 
        this.selectedIndex - 1;
    }
  }

  navigateToNovel(novel: Novel): void {
    if (novel && novel.id) {
      this.close();
      this.router.navigate(['/novel', novel.id]);
    }
  }

  navigateToSearchPage(): void {
    this.close();
    this.router.navigate(['/search'], { 
      queryParams: { query: this.searchQuery.trim() } 
    });
  }

  close(): void {
    this.closeModal.emit();
  }

  getStatusText(status: number): string {
    switch (status) {
      case NovelStatus.Completed:
        return 'Completed';
      case NovelStatus.Abandoned:
        return 'Abandoned';
      case NovelStatus.Frozen:
        return 'Frozen';
      case NovelStatus.InProgress:
        return 'In Progress';
      default:
        return '';
    }
  }
}
