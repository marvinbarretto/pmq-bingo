import { Phrase } from './phrase.model';

export interface BingoCell {
  phrase: Phrase;
  marked: boolean;
  position: number;
}

export interface GameState {
  cells: BingoCell[];
  hasWon: boolean;
  winType: WinType | null;
  winningCells: number[];
}

export type WinType = 'row' | 'column' | 'diagonal' | 'fullHouse';

export const GRID_SIZE = 5;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
