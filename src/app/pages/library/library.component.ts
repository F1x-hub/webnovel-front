import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LibraryService } from '../../services/library.service';
import { NovelService } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { Novel } from '../../components/novel-card/novel-card.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.css']
})
export class LibraryComponent implements OnInit {
  myLibrary: Novel[] = [];
  loading = false;
  error: string | null = null;
  currentPage = 1;
  pageSize = 12;
  totalPages = 1;
  
  constructor(
    private libraryService: LibraryService,
    private novelService: NovelService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUserLibrary();
  }
  
  loadUserLibrary(): void {
    if (!this.authService.isLoggedIn) {
      this.error = 'Please sign in to view your library';
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.error = 'Unable to identify user. Please sign in again.';
      return;
    }
    
    this.loading = true;
    this.error = null;
    
    this.libraryService.getUserLibrary(userId)
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (data) => {
          // Temporary array to hold novels with basic info
          const libraryNovels = Array.isArray(data) ? data.map(item => {
            // Get the novel ID
            const novelId = item.novelId || item.novel?.id || item.id;
            
            // Directly construct the image URL using the endpoint
            const imageUrl = novelId 
              ? `${environment.apiUrl}/api/Image/get-novel-image/${novelId}?t=${Date.now()}`
              : undefined;
              
            return {
              id: novelId,
              title: item.novelTitle || item.novel?.title || item.title,
              genre: item.novelGenre || item.novel?.genre || item.genre || '',
              imageUrl: imageUrl,
              currentChapter: item.lastReadChapter || item.novel?.currentChapter || item.currentChapter,
              totalChapters: item.totalChapters || item.novel?.totalChapters,
              author: item.novelAuthor || item.novel?.author || item.author,
              rating: item.novelRating || item.novel?.rating || item.rating
            } as Novel;
          }) : [];
          
          this.myLibrary = libraryNovels;
          this.totalPages = Math.ceil(this.myLibrary.length / this.pageSize) || 1;
          console.log('Library novels with direct image URLs:', this.myLibrary);
        },
        error: (error) => {
          console.error('Error loading library:', error);
          
          // Handle 404 as empty library, not as an error
          if (error.status === 404) {
            this.myLibrary = [];
            this.totalPages = 1;
            return;
          }
          
          this.error = 'An error occurred while loading your library. Please try again later.';
        }
      });
  }
  
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadUserLibrary();
    }
  }
  
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadUserLibrary();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadUserLibrary();
    }
  }

  getPages(): number[] {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      const startPage = Math.max(2, this.currentPage - 1);
      const endPage = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      // Add ellipsis if needed
      if (startPage > 2) {
        pages.push(-1); // -1 represents an ellipsis
      }
      
      // Add pages around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (endPage < this.totalPages - 1) {
        pages.push(-1); // -1 represents an ellipsis
      }
      
      // Always show last page
      pages.push(this.totalPages);
    }
    
    return pages;
  }
} 