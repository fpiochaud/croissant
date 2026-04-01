import { Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { CroissantService } from '../../croissant.service';
import { APP_VERSION } from '../../../version';

@Component({
  selector: 'croissant-sync-bar',
  imports: [NgClass],
  templateUrl: './sync-bar.component.html',
  styleUrl: './sync-bar.component.css',
})
export class SyncBarComponent {
  croissant = inject(CroissantService);
  syncStatus = this.croissant.syncStatus;
  version = APP_VERSION;
  syncLabel = computed(() => {
    switch (this.croissant.syncStatus()) {
      case 'online':  return 'Synchronisé avec Firebase';
      case 'offline': return 'Hors ligne — reconnexion…';
      default:        return 'Connexion à Firebase…';
    }
  });

}
