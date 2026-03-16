import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CroissantHeader } from './croissant-header';
import { CroissantSyncBar } from './croissant-sync-bar';
import { CroissantNavigation } from './croissant-navigation';
import { CroissantRotation } from './croissant-rotation';
import { CroissantRemplacement } from './croissant-remplacement';
import { CroissantHistorique } from './croissant-historique';
import { CroissantRappels } from './croissant-rappels';
import { CroissantParametres } from './croissant-parametres';
import { CroissantModaux } from './croissant-modaux';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CroissantHeader,
    CroissantSyncBar,
    CroissantNavigation,
    CroissantRotation,
    CroissantRemplacement,
    CroissantHistorique,
    CroissantRappels,
    CroissantParametres,
    CroissantModaux,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('croissant-angular');
}
