import { Component, inject } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-navigation',
  imports: [],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.css',
})
export class NavigationComponent {
  croissant = inject(CroissantService);
  activeTab = this.croissant.activeTab;

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.croissant.openTab(tab);
  }
}
