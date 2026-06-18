import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';

import { BingoCell } from './bingo-cell';
import { BingoCell as BingoCellModel } from '../../models/game.model';

const mockCell: BingoCellModel = {
  phrase: { id: '1', text: 'Test phrase' },
  marked: false,
  position: 0,
};

describe('BingoCell', () => {
  let component: BingoCell;
  let fixture: ComponentFixture<BingoCell>;
  let componentRef: ComponentRef<BingoCell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BingoCell]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BingoCell);
    componentRef = fixture.componentRef;
    componentRef.setInput('cell', mockCell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
