import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { HomeComponent } from './pages/home/home.component';
import { BrowseComponent } from './pages/browse/browse.component';
import { NovelCardComponent } from './components/novel-card/novel-card.component';
import { ReadComponent } from './pages/read/read.component';
import { LibraryComponent } from './pages/library/library.component';
import { CreateComponent } from './pages/create/create.component';
import { AuthInterceptor } from './services/auth.interceptor';
import { NetworkErrorService } from './services/network-error.service';
import { NovelDetailComponent } from './pages/novel-detail/novel-detail.component';
import { ChapterCommentsComponent } from './components/chapter-comments/chapter-comments.component';
import { NovelCommentsComponent } from './components/novel-comments/novel-comments.component';
import { LibraryService } from './services/library.service';
import { StarRatingComponent } from './shared/star-rating/star-rating.component';
import { SharedModule } from './shared/shared.module';
import { AgeVerificationModalComponent } from './components/age-verification-modal/age-verification-modal.component';
import { AgeVerificationWrapperComponent } from './components/age-verification-wrapper/age-verification-wrapper.component';
import { AgeVerificationService } from './services/age-verification.service';
import { SearchComponent } from './pages/search/search.component';
import { FooterComponent } from './shared/footer/footer.component';
import { VpnErrorModalComponent } from './components/vpn-error-modal/vpn-error-modal.component';
import { ConnectionErrorService } from './services/connection-error.service';
import { TestErrorService } from './services/test-error.service';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    HomeComponent,
    BrowseComponent,
    NovelCardComponent,
    ReadComponent,
    LibraryComponent,
    CreateComponent,
    NovelDetailComponent,
    ChapterCommentsComponent,
    NovelCommentsComponent,
    StarRatingComponent,
    AgeVerificationModalComponent,
    AgeVerificationWrapperComponent,
    SearchComponent,
    FooterComponent,
    VpnErrorModalComponent
  ],
  imports: [
    BrowserModule,
    RouterModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule,
    SharedModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: NetworkErrorService, multi: true },
    LibraryService,
    AgeVerificationService,
    ConnectionErrorService,
    TestErrorService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
