import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NovelListComponent } from './novel-list.component';

describe('NovelListComponent', () => {
  let component: NovelListComponent;
  let fixture: ComponentFixture<NovelListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NovelListComponent]
    });
    fixture = TestBed.createComponent(NovelListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
