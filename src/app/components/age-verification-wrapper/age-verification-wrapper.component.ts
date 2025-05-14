import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AgeVerificationService } from '../../services/age-verification.service';

@Component({
  selector: 'app-age-verification-wrapper',
  templateUrl: './age-verification-wrapper.component.html',
  styleUrls: ['./age-verification-wrapper.component.css']
})
export class AgeVerificationWrapperComponent implements OnInit, OnDestroy {
  showModal = false;
  currentNovelId: number | null = null;
  private modalSubscription?: Subscription;
  private novelIdSubscription?: Subscription;

  constructor(private ageVerificationService: AgeVerificationService) {}

  ngOnInit(): void {
    this.modalSubscription = this.ageVerificationService.showModal$.subscribe(
      show => this.showModal = show
    );
    
    this.novelIdSubscription = this.ageVerificationService.currentNovelId$.subscribe(
      id => this.currentNovelId = id
    );
  }

  ngOnDestroy(): void {
    if (this.modalSubscription) {
      this.modalSubscription.unsubscribe();
    }
    if (this.novelIdSubscription) {
      this.novelIdSubscription.unsubscribe();
    }
  }

  onVerificationComplete(verified: boolean): void {
    this.ageVerificationService.hideVerificationModal();
  }
} 