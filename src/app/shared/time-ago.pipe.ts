import { Pipe, PipeTransform, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  pure: false
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer: number | null = null;
  private lastValue: string | Date | null = null;
  private lastFormattedValue: string = '';

  constructor(private changeDetectorRef: ChangeDetectorRef, private ngZone: NgZone) {}

  transform(value: string | Date | null): string {
    if (!value) return '';

    // Don't redo the calculation if the date hasn't changed
    if (this.lastValue === value) {
      return this.lastFormattedValue;
    }

    this.lastValue = value;
    
    // Parse the date
    const date = value instanceof Date ? value : new Date(value);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const now = new Date();
    const seconds = Math.round(Math.abs((now.getTime() - date.getTime()) / 1000));
    const minutes = Math.round(Math.abs(seconds / 60));
    const hours = Math.round(Math.abs(minutes / 60));
    const days = Math.round(Math.abs(hours / 24));
    const months = Math.round(Math.abs(days / 30.416));
    const years = Math.round(Math.abs(days / 365));

    // Format the relative time
    if (seconds <= 45) {
      this.lastFormattedValue = 'just now';
    } else if (seconds <= 90) {
      this.lastFormattedValue = '1 minute ago';
    } else if (minutes <= 45) {
      this.lastFormattedValue = minutes + ' minutes ago';
    } else if (minutes <= 90) {
      this.lastFormattedValue = '1 hour ago';
    } else if (hours <= 22) {
      this.lastFormattedValue = hours + ' hours ago';
    } else if (hours <= 36) {
      this.lastFormattedValue = '1 day ago';
    } else if (days <= 25) {
      this.lastFormattedValue = days + ' days ago';
    } else if (days <= 45) {
      this.lastFormattedValue = '1 month ago';
    } else if (days <= 345) {
      this.lastFormattedValue = months + ' months ago';
    } else if (days <= 545) {
      this.lastFormattedValue = '1 year ago';
    } else {
      this.lastFormattedValue = years + ' years ago';
    }

    // Set up a timer to update the value periodically
    this.removeTimer();
    this.ngZone.runOutsideAngular(() => {
      this.timer = window.setTimeout(() => {
        this.ngZone.run(() => this.changeDetectorRef.markForCheck());
      }, this.getRefreshInterval(seconds));
    });

    return this.lastFormattedValue;
  }

  private getRefreshInterval(seconds: number): number {
    // Determine how often to refresh based on how old the date is
    if (seconds < 60) {
      return 5000; // Update every 5 seconds for less than a minute
    } else if (seconds < 3600) {
      return 60000; // Update every minute for less than an hour
    } else if (seconds < 86400) {
      return 300000; // Update every 5 minutes for less than a day
    } else {
      return 3600000; // Update every hour for older dates
    }
  }

  private removeTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy() {
    this.removeTimer();
  }
} 