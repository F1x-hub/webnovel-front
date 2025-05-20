import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { ConnectionErrorService } from '../../services/connection-error.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-vpn-error-modal',
  templateUrl: './vpn-error-modal.component.html',
  styleUrls: ['./vpn-error-modal.component.css']
})
export class VpnErrorModalComponent implements OnInit, OnDestroy {
  showModal = false;
  private subscription: Subscription = new Subscription();

  constructor(
    private connectionErrorService: ConnectionErrorService,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.connectionErrorService.showModal$.subscribe((show) => {
        this.showModal = show;
        
        // Disable scrolling when modal opens
        if (show) {
          this.renderer.setStyle(document.body, 'overflow', 'hidden');
        } else {
          this.renderer.setStyle(document.body, 'overflow', '');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    // Re-enable scrolling
    this.renderer.setStyle(document.body, 'overflow', '');
  }

  closeModal(): void {
    this.connectionErrorService.hideVpnModal();
  }
} 