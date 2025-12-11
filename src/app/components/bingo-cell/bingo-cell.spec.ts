import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BingoCell } from './bingo-cell';

describe('BingoCell', () => {
  let component: BingoCell;
  let fixture: ComponentFixture<BingoCell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BingoCell]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BingoCell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
