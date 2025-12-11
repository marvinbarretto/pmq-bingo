import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BingoCard } from '../bingo-card/bingo-card';
import { GameControls } from '../game-controls/game-controls';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game-page',
  imports: [BingoCard, GameControls, RouterLink],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage implements OnInit {
  private readonly gameService = inject(GameService);
  readonly isLoading = this.gameService.isLoading;

  ngOnInit(): void {
    this.gameService.initialize();
  }
}
