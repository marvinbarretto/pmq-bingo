import { Component, computed, input, output } from '@angular/core';
import { BingoCell as BingoCellModel } from '../../models/game.model';

@Component({
  selector: 'app-bingo-cell',
  imports: [],
  templateUrl: './bingo-cell.html',
  styleUrl: './bingo-cell.scss',
})
export class BingoCell {
  cell = input.required<BingoCellModel>();
  isWinning = input<boolean>(false);

  cellClicked = output<number>();

  readonly words = computed(() => this.cell().phrase.text.split(' '));

  onClick(): void {
    this.cellClicked.emit(this.cell().position);
  }
}
