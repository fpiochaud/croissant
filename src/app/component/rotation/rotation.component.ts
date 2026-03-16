import { Component, computed, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { CroissantService, Person } from '../../croissant.service';
import { ModauxComponent } from '../modaux/modaux.component';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  selectedPerson: Person | null = null;
  persons = computed(() => this.croissant.state().persons);
  modaux = inject(ModauxComponent, { optional: true });

  constructor(public croissant: CroissantService) {}

  openAddModal() {
    if (this.modaux) this.modaux.openAddModal();
  }

  editPerson(person: Person) {
    if (this.modaux) this.modaux.openEditModal(person);
  }

  deletePerson(person: Person) {
    this.croissant.deletePerson(person);
  }
}
