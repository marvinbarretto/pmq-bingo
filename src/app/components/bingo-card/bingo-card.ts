import { Component, inject } from '@angular/core';
import { BingoCell } from '../bingo-cell/bingo-cell';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-bingo-card',
  imports: [BingoCell],
  templateUrl: './bingo-card.html',
  styleUrl: './bingo-card.scss',
})
export class BingoCard {
  private readonly gameService = inject(GameService);

  readonly cells = this.gameService.cells;
  readonly winningCells = this.gameService.winningCells;

  onCellClicked(position: number): void {
    this.gameService.toggleCell(position);
  }

  isWinningCell(position: number): boolean {
    return this.winningCells().includes(position);
  }
}
