import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeAgoPipe } from './time-ago.pipe';
import { SafeHtmlPipe } from './safe-html.pipe';
import { SearchModalComponent } from './search-modal/search-modal.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    TimeAgoPipe,
    SafeHtmlPipe,
    SearchModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule
  ],
  exports: [
    FormsModule,
    TimeAgoPipe,
    SafeHtmlPipe,
    SearchModalComponent
  ]
})
export class SharedModule { } 