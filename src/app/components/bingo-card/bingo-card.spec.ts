import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BingoCard } from './bingo-card';

describe('BingoCard', () => {
  let component: BingoCard;
  let fixture: ComponentFixture<BingoCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BingoCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BingoCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
