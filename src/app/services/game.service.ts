import { Injectable, computed, inject, signal } from '@angular/core';
import { BingoCell, GameState, GRID_SIZE, TOTAL_CELLS, WinType } from '../models/game.model';
import { PhraseService } from './phrase.service';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly phraseService = inject(PhraseService);
  private state = signal<GameState>(this.createEmptyState());

  readonly cells = computed(() => this.state().cells);
  readonly hasWon = computed(() => this.state().hasWon);
  readonly winType = computed(() => this.state().winType);
  readonly winningCells = computed(() => this.state().winningCells);
  readonly markedCount = computed(() => this.state().cells.filter((c) => c.marked).length);
  readonly isLoading = computed(() => this.state().cells.length === 0);

  // Signal to trigger win modal - increments when a new win occurs
  private readonly winCounter = signal(0);
  readonly newWin = computed(() => this.winCounter());

  async initialize(): Promise<void> {
    await this.phraseService.loadPhrases();
    const savedState = this.loadState();
    if (savedState) {
      this.state.set(savedState);
    } else {
      this.state.set(this.createInitialState());
    }
  }

  private createEmptyState(): GameState {
    return {
      cells: [],
      hasWon: false,
      winType: null,
      winningCells: [],
    };
  }

  private createInitialState(): GameState {
    return {
      cells: this.generateBoard(),
      hasWon: false,
      winType: null,
      winningCells: [],
    };
  }

  private generateBoard(): BingoCell[] {
    const phrases = this.phraseService.getRandomPhrases(TOTAL_CELLS);
    return phrases.map((phrase, index) => ({
      phrase,
      marked: false,
      position: index,
    }));
  }

  toggleCell(position: number): void {
    if (this.state().hasWon) return;

    this.state.update((state) => {
      const cells = state.cells.map((cell) =>
        cell.position === position ? { ...cell, marked: !cell.marked } : cell
      );

      const winResult = this.checkWin(cells);
      const justWon = winResult.hasWon && !state.hasWon;

      // Trigger win modal if this is a new win
      if (justWon) {
        setTimeout(() => this.winCounter.update((c) => c + 1), 0);
      }

      return {
        ...state,
        cells,
        hasWon: winResult.hasWon,
        winType: winResult.winType,
        winningCells: winResult.winningCells,
      };
    });

    this.saveState();
  }

  private checkWin(cells: BingoCell[]): {
    hasWon: boolean;
    winType: WinType | null;
    winningCells: number[];
  } {
    // Check rows
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowCells = cells.filter(
        (_, i) => Math.floor(i / GRID_SIZE) === row
      );
      if (rowCells.every((c) => c.marked)) {
        return {
          hasWon: true,
          winType: 'row',
          winningCells: rowCells.map((c) => c.position),
        };
      }
    }

    // Check columns
    for (let col = 0; col < GRID_SIZE; col++) {
      const colCells = cells.filter((_, i) => i % GRID_SIZE === col);
      if (colCells.every((c) => c.marked)) {
        return {
          hasWon: true,
          winType: 'column',
          winningCells: colCells.map((c) => c.position),
        };
      }
    }

    // Check diagonals
    const diagonal1 = cells.filter(
      (_, i) => i % (GRID_SIZE + 1) === 0
    );
    if (diagonal1.every((c) => c.marked)) {
      return {
        hasWon: true,
        winType: 'diagonal',
        winningCells: diagonal1.map((c) => c.position),
      };
    }

    const diagonal2 = cells.filter(
      (_, i) => i % (GRID_SIZE - 1) === 0 && i > 0 && i < TOTAL_CELLS - 1
    );
    if (diagonal2.every((c) => c.marked)) {
      return {
        hasWon: true,
        winType: 'diagonal',
        winningCells: diagonal2.map((c) => c.position),
      };
    }

    // Check full house
    if (cells.every((c) => c.marked)) {
      return {
        hasWon: true,
        winType: 'fullHouse',
        winningCells: cells.map((c) => c.position),
      };
    }

    return { hasWon: false, winType: null, winningCells: [] };
  }

  newGame(): void {
    this.state.set(this.createInitialState());
    this.saveState();
  }

  getShareText(): string {
    const cells = this.state().cells;
    let text = 'PMQ Bingo!\n\n';

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = cells[row * GRID_SIZE + col];
        const isWinning = this.state().winningCells.includes(cell.position);
        if (isWinning) {
          text += '🟩';
        } else if (cell.marked) {
          text += '🟨';
        } else {
          text += '⬜';
        }
      }
      text += '\n';
    }

    text += `\n${this.markedCount()}/${TOTAL_CELLS} phrases spotted`;
    if (this.state().hasWon) {
      text += ` - ${this.state().winType?.toUpperCase()}!`;
    }

    return text;
  }

  private saveState(): void {
    try {
      localStorage.setItem('pmq-bingo-state', JSON.stringify(this.state()));
    } catch {
      // localStorage not available
    }
  }

  private loadState(): GameState | null {
    try {
      const saved = localStorage.getItem('pmq-bingo-state');
      if (saved) {
        return JSON.parse(saved) as GameState;
      }
    } catch {
      // localStorage not available or corrupted
    }
    return null;
  }
}
