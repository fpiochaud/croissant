import { Component, inject } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-navigation',
  imports: [],
  templateUrl: './croissant-navigation.html',
  styleUrl: './croissant-navigation.css',
})
export class CroissantNavigation {
  croissant = inject(CroissantService);
  activeTab = this.croissant.activeTab;

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.croissant.openTab(tab);
  }
}
