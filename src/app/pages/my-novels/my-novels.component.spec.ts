import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyNovelsComponent } from './my-novels.component';

describe('MyNovelsComponent', () => {
  let component: MyNovelsComponent;
  let fixture: ComponentFixture<MyNovelsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyNovelsComponent]
    });
    fixture = TestBed.createComponent(MyNovelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
