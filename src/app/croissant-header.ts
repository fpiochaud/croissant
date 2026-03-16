import { Component, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-header',
  imports: [NgIf],
  templateUrl: './croissant-header.html',
  styleUrl: './croissant-header.css',
})
export class CroissantHeader {
  teamName = computed(() => this.croissant.state().teamName);
  nextName = computed(() => {
    const s = this.croissant.state();
    return s.persons[s.currentIndex]?.name ?? '—';
  });
  nextDate = computed(() => {
    // Logique de date à adapter selon l'app originale
    return '—';
  });
  isNextUser = computed(() => false); // À adapter si besoin

  constructor(public croissant: CroissantService) {}
}
