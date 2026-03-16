import { Component, computed } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-historique',
  imports: [],
  templateUrl: './croissant-historique.html',
  styleUrl: './croissant-historique.css',
})
export class CroissantHistorique {
  history = computed(() => this.croissant.state().history);
  constructor(public croissant: CroissantService) {}
}
