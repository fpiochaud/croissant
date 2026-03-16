import { Component, computed, signal } from '@angular/core';
import { NgFor } from '@angular/common';
import { CroissantService, Person } from '../../croissant.service';

@Component({
  selector: 'croissant-remplacement',
  imports: [NgFor],
  templateUrl: './remplacement.component.html',
  styleUrl: './remplacement.component.css',
})
export class RemplacementComponent {
  persons = computed(() => this.croissant.state().persons);
  rules = computed(() => this.croissant.state().rules);
  absentId = signal<string>('');
  swapPreview = signal<{ absent?: Person; replacement?: Person } | null>(null);

  constructor(public croissant: CroissantService) {}

  updateSwapPreview() {
    const id = (document.getElementById('absent-select') as HTMLSelectElement)?.value;
    this.absentId.set(id);
    const absent = this.persons().find(p => p.id === id);
    let replacement: Person | undefined = undefined;
    if (absent && this.rules().auto) {
      const idx = this.persons().findIndex(p => p.id === id);
      if (idx !== -1 && this.persons().length > 1) {
        let nextIdx = (idx + 1) % this.persons().length;
        let tries = 0;
        while (this.persons()[nextIdx].status === 'absent' && tries < this.persons().length) {
          nextIdx = (nextIdx + 1) % this.persons().length;
          tries++;
        }
        if (this.persons()[nextIdx].id !== id) {
          replacement = this.persons()[nextIdx];
        }
      }
    }
    this.swapPreview.set(absent ? { absent, replacement } : null);
    const preview = document.getElementById('swap-preview');
    if (preview) preview.style.display = absent ? '' : 'none';
    const flow = document.getElementById('swap-flow');
    if (flow) flow.innerText = replacement ? `${absent?.name} → ${replacement.name}` : 'Aucun remplaçant trouvé';
    const note = document.getElementById('swap-note');
    if (note) note.innerText = replacement ? '' : 'Aucun remplaçant disponible.';
  }

  confirmSwap() {
    const preview = this.swapPreview();
    if (preview?.absent) {
      this.croissant.setPersonAbsent(preview.absent.id);
      this.croissant.addHistory({
        date: new Date().toLocaleString(),
        type: 'Absence',
        details: {
          text: preview.replacement
            ? `${preview.absent.name} remplacé(e) par ${preview.replacement.name}`
            : `${preview.absent.name} absent(e), pas de remplaçant disponible`,
        },
      });
      this.absentId.set('');
      this.swapPreview.set(null);
      (document.getElementById('absent-select') as HTMLSelectElement).value = '';
      const domPreview = document.getElementById('swap-preview');
      if (domPreview) domPreview.style.display = 'none';
    }
  }

  manualSwap() {
    alert('Sélection manuelle à implémenter');
  }

  toggleRule(rule: 'auto' | 'catch' | 'manual') {
    this.croissant.setRule(rule, !this.rules()[rule]);
  }
}
