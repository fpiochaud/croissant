import { Component, computed, afterNextRender } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-historique',
  imports: [],
  templateUrl: './historique.component.html',
  styleUrl: './historique.component.css',
})
export class HistoriqueComponent {
  history = computed(() => this.croissant.state().history);

  constructor(public croissant: CroissantService) {
    // Charge la page suivante dès que le sentinel de fin de liste devient visible.
    afterNextRender(() => {
      const sentinel = document.getElementById('history-sentinel');
      if (!sentinel) return;
      new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.croissant.loadMoreHistory();
      }).observe(sentinel);
    });
  }
}
