import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameControls } from './game-controls';

describe('GameControls', () => {
  let component: GameControls;
  let fixture: ComponentFixture<GameControls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameControls]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameControls);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
