import { Component, computed } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-parametres',
  imports: [],
  templateUrl: './croissant-parametres.html',
  styleUrl: './croissant-parametres.css',
})
export class CroissantParametres {
  teamName = computed(() => this.croissant.state().teamName);
  memberCount = computed(() => this.croissant.state().persons.length);
  constructor(public croissant: CroissantService) {}

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.croissant.openTab(tab);
  }

  exportData() {
    const data = JSON.stringify(this.croissant.state(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'croissant-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  resetData() {
    if (confirm('Réinitialiser toutes les données ?')) {
      location.reload(); // Pour la démo, recharger (remplacer par reset state réel si besoin)
    }
  }
}
