import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { WinType } from '../../models/game.model';
import { CelebrationGif } from '../celebration-gif/celebration-gif';
import { featureFlags } from '../../feature-flags';

export interface WinModalData {
  winType: WinType;
  shareText: string;
}

@Component({
  selector: 'app-win-modal',
  imports: [CelebrationGif],
  templateUrl: './win-modal.html',
  styleUrl: './win-modal.scss',
})
export class WinModal {
  private readonly dialogRef = inject(DialogRef<string>);
  private readonly document = inject(DOCUMENT);
  readonly data = inject<WinModalData>(DIALOG_DATA);
  readonly shareEnabled = featureFlags.share;

  get winTypeDisplay(): string {
    switch (this.data.winType) {
      case 'row':
        return 'ROW!';
      case 'column':
        return 'COLUMN!';
      case 'diagonal':
        return 'DIAGONAL!';
      case 'fullHouse':
        return 'FULL HOUSE!';
      default:
        return 'BINGO!';
    }
  }

  onNewGame(): void {
    this.dialogRef.close('newGame');
  }

  async onShare(): Promise<void> {
    const nav = this.document.defaultView?.navigator;

    if (nav?.share) {
      try {
        await nav.share({ text: this.data.shareText });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    if (nav?.clipboard) {
      try {
        await nav.clipboard.writeText(this.data.shareText);
        return;
      } catch {
        // Fall through
      }
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
