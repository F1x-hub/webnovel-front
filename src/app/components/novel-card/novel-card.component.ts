import { Component, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

export enum NovelStatus {
  InProgress = 1,
  Frozen = 2,
  Abandoned = 3,
  Completed = 4
}

export interface Novel {
  id?: number;
  title: string;
  genre: string;
  genres?: string[];
  imageUrl?: string;
  rating?: number;
  ratingsCount?: number;
  currentChapter?: number;
  totalChapters?: number;
  author?: string;
  description?: string;
  userId?: number;
  views?: number;
  status?: NovelStatus;
  isAdultContent?: boolean;
}

@Component({
  selector: 'app-novel-card',
  templateUrl: './novel-card.component.html',
  styleUrls: ['./novel-card.component.css']
})
export class NovelCardComponent {
  @Input() novel: Novel = {
    title: '',
    genre: ''
  };
  @Input() showProgress: boolean = true;
  imageLoaded: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  navigateToNovel(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.novel.id) return;

    // Сохраняем текущий URL перед навигацией
    // Это гарантирует, что браузер правильно обработает "назад"
    const currentUrl = this.location.path();
    
    console.log(`NovelCard navigation: id=${this.novel.id}, currentChapter=${this.novel.currentChapter}, currentUrl=${currentUrl}`);
    
    if (this.novel.currentChapter && this.novel.currentChapter >= 1) {
      console.log(`Navigating to chapter: ${this.novel.currentChapter}`);
      this.router.navigate(['/read', this.novel.id, this.novel.currentChapter], { 
        state: { prevUrl: currentUrl }
      });
    } else {
      console.log('Navigating to novel details page');
      this.router.navigate(['/novel', this.novel.id], { 
        state: { prevUrl: currentUrl }
      });
    }
  }

  onImageError(event: Event): void {
    // When the image fails to load, set default cover
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/default-cover.png';
      this.imageLoaded = true;
    }
  }

  onImageLoad(): void {
    this.imageLoaded = true;
  }
}
