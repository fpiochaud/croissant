import { Component, computed } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-historique',
  imports: [NgFor, NgIf],
  templateUrl: './croissant-historique.html',
  styleUrl: './croissant-historique.css',
})
export class CroissantHistorique {
  history = computed(() => this.croissant.state().history);
  constructor(public croissant: CroissantService) {}
}
