import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AgeVerificationService {
  private showModalSubject = new BehaviorSubject<boolean>(false);
  private currentNovelIdSubject = new BehaviorSubject<number | null>(null);

  public showModal$ = this.showModalSubject.asObservable();
  public currentNovelId$ = this.currentNovelIdSubject.asObservable();

  constructor(private authService: AuthService) {}

  isUserAdult(): boolean {
    const currentUser = this.authService.currentUserValue;
    return !!currentUser?.isAdult;
  }

  showVerificationModal(novelId?: number): void {
    if (novelId) {
      this.currentNovelIdSubject.next(novelId);
    }
    this.showModalSubject.next(true);
  }

  hideVerificationModal(): void {
    this.showModalSubject.next(false);
  }

  checkContentAccess(isAdultContent: boolean): boolean {
    // If content is not adult, allow access
    if (!isAdultContent) {
      return true;
    }
    
    // If user is logged in and is an adult, allow access
    if (this.isUserAdult()) {
      return true;
    }
    
    // Otherwise, show verification modal and block access
    return false;
  }
} 