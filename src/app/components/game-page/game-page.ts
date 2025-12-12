import { Component, effect, inject, OnInit } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { BingoCard } from '../bingo-card/bingo-card';
import { GameControls } from '../game-controls/game-controls';
import { GameService } from '../../services/game.service';
import { WinModal, WinModalData } from '../win-modal/win-modal';
import { APP_VERSION } from '../../version';

@Component({
  selector: 'app-game-page',
  imports: [BingoCard, GameControls],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage implements OnInit {
  private readonly gameService = inject(GameService);
  private readonly dialog = inject(Dialog);
  readonly isLoading = this.gameService.isLoading;
  readonly version = APP_VERSION;

  constructor() {
    // Watch for new wins and show modal
    effect(() => {
      const winCount = this.gameService.newWin();
      if (winCount > 0 && this.gameService.hasWon()) {
        this.showWinModal();
      }
    });
  }

  ngOnInit(): void {
    this.gameService.initialize();
  }

  private showWinModal(): void {
    const winType = this.gameService.winType();
    if (!winType) return;

    const dialogRef = this.dialog.open<string>(WinModal, {
      data: {
        winType,
        shareText: this.gameService.getShareText(),
      } as WinModalData,
      panelClass: 'win-modal-panel',
    });

    dialogRef.closed.subscribe((result) => {
      if (result === 'newGame') {
        this.gameService.newGame();
      }
    });
  }
}
