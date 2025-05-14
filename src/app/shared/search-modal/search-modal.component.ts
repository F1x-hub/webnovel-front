import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NovelService } from '../../services/novel.service';
import { Novel, NovelStatus } from '../../components/novel-card/novel-card.component';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';

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
  
  private searchQuerySubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  constructor(
    private novelService: NovelService,
    private router: Router
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
    
    // Use userId = 0 for anonymous search (can be updated to use actual user ID if needed)
    this.novelService.getNovelByName(query, 0).subscribe({
      next: (results) => {
        this.searchResults = results.slice(0, 7); // Limit to 7 results for better UI
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
    }
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
