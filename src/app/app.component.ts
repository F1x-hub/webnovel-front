import { Component, OnInit } from '@angular/core';
import { ConnectionErrorService } from './services/connection-error.service';
import { TestErrorService } from './services/test-error.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'WebNovel';

  constructor(
    private connectionErrorService: ConnectionErrorService,
    private testErrorService: TestErrorService
  ) {}

  ngOnInit(): void {
    // Initialize the connection error service
    // The VpnErrorModalComponent will subscribe to the service events
    
    // Test code removed - VPN modal will now only appear on actual ERR_CONNECTION_CLOSED errors
  }
}
