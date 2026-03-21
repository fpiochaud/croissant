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
  manualMode = signal(false);
  manualReplacementId = signal<string>('');

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
      this.croissant.setPersonAbsent(preview.absent.id, preview.replacement?.name);
      if (preview.replacement) {
        this.croissant.promoteReplacement(preview.absent.id, preview.replacement.id);
      }
      this.croissant.addPendingSwapNotification(
        preview.absent.name,
        preview.replacement?.name ?? ''
      );
      this.croissant.addHistory({
        date: new Date().toLocaleString(),
        type: 'Absence',
        details: {
          text: preview.replacement
            ? `${preview.absent.name} remplacé(e) par ${preview.replacement.name}`
            : `${preview.absent.name} absent(e), pas de remplaçant disponible`,
        },
      });
      this.reset();
    }
  }

  manualSwap() {
    this.manualMode.set(true);
    this.manualReplacementId.set('');
  }

  confirmManualSwap() {
    const absent = this.swapPreview()?.absent;
    const replacement = this.persons().find(p => p.id === this.manualReplacementId());
    if (!absent || !replacement) return;
    this.croissant.setPersonAbsent(absent.id, replacement.name);
    this.croissant.promoteReplacement(absent.id, replacement.id);
    this.croissant.addPendingSwapNotification(absent.name, replacement.name);
    this.croissant.addHistory({
      date: new Date().toLocaleString(),
      type: 'Absence',
      details: { text: `${absent.name} remplacé(e) manuellement par ${replacement.name}` },
    });
    this.reset();
  }

  private reset() {
    this.absentId.set('');
    this.swapPreview.set(null);
    this.manualMode.set(false);
    this.manualReplacementId.set('');
    (document.getElementById('absent-select') as HTMLSelectElement).value = '';
    const domPreview = document.getElementById('swap-preview');
    if (domPreview) domPreview.style.display = 'none';
  }

  toggleRule(rule: 'auto' | 'catch' | 'manual') {
    this.croissant.setRule(rule, !this.rules()[rule]);
  }
}
