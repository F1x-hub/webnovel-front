import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NovelCommentsComponent } from './novel-comments.component';

describe('NovelCommentsComponent', () => {
  let component: NovelCommentsComponent;
  let fixture: ComponentFixture<NovelCommentsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NovelCommentsComponent]
    });
    fixture = TestBed.createComponent(NovelCommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
