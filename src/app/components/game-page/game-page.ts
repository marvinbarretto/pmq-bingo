import { Component, effect, inject, OnInit } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { BingoCard } from '../bingo-card/bingo-card';
import { GameControls } from '../game-controls/game-controls';
import { PmqCountdown } from '../pmq-countdown/pmq-countdown';
import { GameService } from '../../services/game.service';
import { SpeechService } from '../../services/speech.service';
import { WinModal, WinModalData } from '../win-modal/win-modal';
import { APP_VERSION } from '../../version';

@Component({
  selector: 'app-game-page',
  imports: [BingoCard, GameControls, PmqCountdown],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage implements OnInit {
  private readonly gameService = inject(GameService);
  private readonly speechService = inject(SpeechService);
  private readonly dialog = inject(Dialog);
  readonly isLoading = this.gameService.isLoading;
  readonly version = APP_VERSION;
  readonly currentWord = this.speechService.currentWord;
  readonly isListening = this.speechService.isListening;

  constructor() {
    // Watch for new wins and show modal
    effect(() => {
      const winCount = this.gameService.newWin();
      if (winCount > 0 && this.gameService.hasWon()) {
        this.showWinModal();
      }
    });

    // Set up phrase matching callback
    this.speechService.onPhraseMatch = (match) => {
      const marked = this.gameService.markCellByPhrase(match.phrase);
      if (marked) {
        console.log(`%c[Bingo] AUTO-MARKED: "${match.phrase}"`, 'color: lime; font-weight: bold; font-size: 14px');
      }
    };
  }

  ngOnInit(): void {
    this.gameService.initialize().then(() => {
      // Set phrases for speech matching after game initializes
      const phrases = this.gameService.getPhraseTexts();
      this.speechService.setPhrases(phrases);
    });
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
