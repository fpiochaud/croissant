import { Component, signal } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-navigation',
  imports: [],
  templateUrl: './croissant-navigation.html',
  styleUrl: './croissant-navigation.css',
})
export class CroissantNavigation {
  activeTab = signal<'rotation'|'remplacement'|'historique'|'rappels'|'params'>('rotation');

  constructor(public croissant: CroissantService) {}

  openTab(tab: typeof this.activeTab.value) {
    this.activeTab.set(tab);
  }
}
