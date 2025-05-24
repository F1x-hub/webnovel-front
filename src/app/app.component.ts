import { Component, OnInit, OnDestroy } from '@angular/core';
import { ConnectionErrorService } from './services/connection-error.service';
import { TestErrorService } from './services/test-error.service';
import { CommentService } from './services/comment.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'WebNovel';

  constructor(
    private connectionErrorService: ConnectionErrorService,
    private testErrorService: TestErrorService,
    private commentService: CommentService
  ) {}

  ngOnInit(): void {
    // Initialize the connection error service
    // The VpnErrorModalComponent will subscribe to the service events
    
    // Test code removed - VPN modal will now only appear on actual ERR_CONNECTION_CLOSED errors
  }
  
  ngOnDestroy(): void {
    // Clean up SignalR connection when app is destroyed
    this.commentService.stopConnection();
  }
}
