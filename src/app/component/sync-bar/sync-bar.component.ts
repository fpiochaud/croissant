import { Component, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-sync-bar',
  imports: [NgClass],
  templateUrl: './sync-bar.component.html',
  styleUrl: './sync-bar.component.css',
})
export class SyncBarComponent {
  syncStatus = computed(() => 'syncing');
  syncLabel = computed(() => 'Connexion à Firebase…');

  constructor(public croissant: CroissantService) {}
}
