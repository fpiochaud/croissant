  selectedPerson: Person | null = null;

import { Component, computed, inject } from '@angular/core';
import { CroissantService, Person } from './croissant.service';
import { CroissantModaux } from './croissant-modaux';

@Component({
  selector: 'croissant-rotation',
  imports: [],
  templateUrl: './croissant-rotation.html',
  styleUrl: './croissant-rotation.css',
})
export class CroissantRotation {
  persons = computed(() => this.croissant.state().persons);
  modaux = inject(CroissantModaux, { optional: true });

  constructor(public croissant: CroissantService) {}

  openAddModal() {
    // Ouvre le modal d'ajout via le composant modaux
    if (this.modaux) this.modaux.openAddModal();
  }

  editPerson(person: Person) {
    if (this.modaux) this.modaux.openEditModal(person);
  }

  deletePerson(person: Person) {
    this.croissant.deletePerson(person);
  }
}
