import { Component, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-sync-bar',
  imports: [NgClass],
  templateUrl: './croissant-sync-bar.html',
  styleUrl: './croissant-sync-bar.css',
})
export class CroissantSyncBar {
  // À remplacer par la vraie logique de sync Firebase
  syncStatus = computed(() => 'syncing');
  syncLabel = computed(() => 'Connexion à Firebase…');

  constructor(public croissant: CroissantService) {}
}
