import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BrowseComponent } from './browse.component';
import { NovelService } from '../../services/novel.service';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { NovelCardComponent } from '../../components/novel-card/novel-card.component';

describe('BrowseComponent', () => {
  let component: BrowseComponent;
  let fixture: ComponentFixture<BrowseComponent>;
  let novelServiceSpy: jasmine.SpyObj<NovelService>;
  
  beforeEach(() => {
    const spy = jasmine.createSpyObj('NovelService', ['getNovels', 'getAllGenres', 'getNovelImageUrl']);
    spy.getNovels.and.returnValue(of({
      novels: [],
      totalPages: 1,
      totalItems: 0,
      currentPage: 1,
      pageSize: 10
    }));
    spy.getAllGenres.and.returnValue(of([]));
    
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [BrowseComponent, NovelCardComponent],
      providers: [
        { provide: NovelService, useValue: spy },
        { provide: AuthService, useValue: { currentUserValue: null } },
        { provide: LibraryService, useValue: { getUserLibrary: () => of([]) } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate'), events: of(new NavigationEnd(1, '', '')) } },
        { provide: Location, useValue: { path: () => '' } }
      ]
    });
    
    fixture = TestBed.createComponent(BrowseComponent);
    component = fixture.componentInstance;
    novelServiceSpy = TestBed.inject(NovelService) as jasmine.SpyObj<NovelService>;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });
  
  it('should load novels on init', () => {
    fixture.detectChanges();
    expect(novelServiceSpy.getNovels).toHaveBeenCalled();
  });
  
  it('should load more novels on scroll', fakeAsync(() => {
    fixture.detectChanges();
    component.currentPage = 1;
    component.totalPages = 2;
    
    // Simulate scrolling
    component.onWindowScroll();
    tick();
    
    expect(novelServiceSpy.getNovels).toHaveBeenCalledTimes(2);
  }));
  
  it('should not load more novels if all pages are loaded', fakeAsync(() => {
    fixture.detectChanges();
    component.currentPage = 1;
    component.totalPages = 1;
    component.allPagesLoaded = true;
    
    // Simulate scrolling
    component.onWindowScroll();
    tick();
    
    // Should only be called once from ngOnInit
    expect(novelServiceSpy.getNovels).toHaveBeenCalledTimes(1);
  }));
  
  it('should reset pagination when filters change', () => {
    fixture.detectChanges();
    component.currentPage = 2;
    
    // Apply filters
    component.applyFilters();
    
    expect(component.currentPage).toBe(1);
  });
}); 