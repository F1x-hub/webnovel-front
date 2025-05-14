import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css']
})
export class StarRatingComponent implements OnInit {
  @Input() rating: number = 0;
  @Input() ratingsCount: number = 0;
  @Input() maxRating: number = 5;
  @Input() readonly: boolean = true;
  @Input() showRatingValue: boolean = true;
  @Input() showRatingsCount: boolean = true;
  @Output() ratingChange = new EventEmitter<number>();
  
  stars: number[] = [];
  hoveredRating: number = 0;
  
  ngOnInit() {
    this.stars = Array(this.maxRating).fill(0).map((_, i) => i + 1);
  }
  
  rate(rating: number): void {
    if (!this.readonly) {
      this.rating = rating;
      this.ratingChange.emit(rating);
    }
  }
  
  hoverStar(rating: number): void {
    if (!this.readonly) {
      this.hoveredRating = rating;
    }
  }
  
  resetHover(): void {
    this.hoveredRating = 0;
  }
  
  getStarClass(star: number): string {
    const currentRating = this.hoveredRating || this.rating;
    if (currentRating >= star) {
      return 'star-filled';
    } else {
      return 'star-empty';
    }
  }
} 