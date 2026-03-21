import { Component, computed } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-parametres',
  imports: [],
  templateUrl: './parametres.component.html',
  styleUrl: './parametres.component.css',
})
export class ParametresComponent {
  teamName = computed(() => this.croissant.state().teamName);
  memberCount = computed(() => this.croissant.state().persons.length);

  firestoreStatus = computed(() => {
    switch (this.croissant.syncStatus()) {
      case 'online':  return '✅ Connecté';
      case 'syncing': return '⏳ Synchronisation…';
      case 'offline': return '❌ Hors ligne';
    }
  });

  fcmLabel = computed(() => {
    switch (this.croissant.fcmStatus()) {
      case 'granted': return '✅ Oui';
      case 'denied':  return '❌ Refusé';
      case 'pending': return '⏳ En attente…';
      case 'idle':    return 'Non';
    }
  });

  constructor(public croissant: CroissantService) {}

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.croissant.openTab(tab);
  }

  logout() {
    this.croissant.logout();
  }
}
