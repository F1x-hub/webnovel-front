import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NovelCreateComponent } from './novel-create.component';

describe('NovelCreateComponent', () => {
  let component: NovelCreateComponent;
  let fixture: ComponentFixture<NovelCreateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NovelCreateComponent]
    });
    fixture = TestBed.createComponent(NovelCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
