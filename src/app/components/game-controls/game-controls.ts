import { Component, inject } from '@angular/core';
import { DOCUMENT, UpperCasePipe } from '@angular/common';
import { GameService } from '../../services/game.service';
import { SpeechService } from '../../services/speech.service';
import { TOTAL_CELLS } from '../../models/game.model';
import { featureFlags } from '../../feature-flags';

@Component({
  selector: 'app-game-controls',
  imports: [UpperCasePipe],
  templateUrl: './game-controls.html',
  styleUrl: './game-controls.scss',
})
export class GameControls {
  private readonly gameService = inject(GameService);
  private readonly speechService = inject(SpeechService);
  private readonly document = inject(DOCUMENT);

  readonly hasWon = this.gameService.hasWon;
  readonly winType = this.gameService.winType;
  readonly markedCount = this.gameService.markedCount;
  readonly totalCells = TOTAL_CELLS;
  readonly isListening = this.speechService.isListening;
  readonly isSpeechSupported = this.speechService.isSupported;
  readonly isModelLoading = this.speechService.isModelLoading;
  readonly speechEnabled = featureFlags.speechToText;

  onNewGame(): void {
    this.gameService.newGame();
  }

  async onToggleSpeech(): Promise<void> {
    await this.speechService.toggle();
  }

  async onShare(): Promise<void> {
    const text = this.gameService.getShareText();
    const nav = this.document.defaultView?.navigator;

    if (nav?.share) {
      try {
        await nav.share({ text });
      } catch {
        await this.copyToClipboard(text);
      }
    } else {
      await this.copyToClipboard(text);
    }
  }

  private async copyToClipboard(text: string): Promise<void> {
    const nav = this.document.defaultView?.navigator;

    if (nav?.clipboard) {
      try {
        await nav.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to legacy method
      }
    }

    // Legacy fallback
    const textarea = this.document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    this.document.body.appendChild(textarea);
    textarea.select();
    this.document.execCommand('copy');
    this.document.body.removeChild(textarea);
  }
}
