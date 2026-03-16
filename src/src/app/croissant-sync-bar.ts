import { Component, computed } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-sync-bar',
  imports: [],
  templateUrl: './croissant-sync-bar.html',
  styleUrl: './croissant-sync-bar.css',
})
export class CroissantSyncBar {
  // À remplacer par la vraie logique de sync Firebase
  syncStatus = computed(() => 'syncing');
  syncLabel = computed(() => 'Connexion à Firebase…');

  constructor(public croissant: CroissantService) {}
}
