import { TestBed } from '@angular/core/testing';

import { NetworkErrorService } from './network-error.service';

describe('NetworkErrorService', () => {
  let service: NetworkErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkErrorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
