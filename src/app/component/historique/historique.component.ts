import { Component, computed } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-historique',
  imports: [],
  templateUrl: './historique.component.html',
  styleUrl: './historique.component.css',
})
export class HistoriqueComponent {
  history = computed(() => this.croissant.state().history);
  constructor(public croissant: CroissantService) {}
}
