import { Component, computed } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-historique',
  imports: [NgFor, NgIf],
  templateUrl: './historique.component.html',
  styleUrl: './historique.component.css',
})
export class HistoriqueComponent {
  history = computed(() => this.croissant.state().history);
  constructor(public croissant: CroissantService) {}
}
