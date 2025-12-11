import { Routes } from '@angular/router';
import { GamePage } from './components/game-page/game-page';
import { PhraseBrowser } from './components/phrase-browser/phrase-browser';

export const routes: Routes = [
  { path: '', component: GamePage },
  { path: 'phrases', component: PhraseBrowser },
];
