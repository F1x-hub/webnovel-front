import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenreManagementComponent } from './genre-management.component';

describe('GenreManagementComponent', () => {
  let component: GenreManagementComponent;
  let fixture: ComponentFixture<GenreManagementComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GenreManagementComponent]
    });
    fixture = TestBed.createComponent(GenreManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
