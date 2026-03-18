import { Component, computed } from '@angular/core';
import { NgFor } from '@angular/common';
import { CroissantService, Person } from '../../croissant.service';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  persons = computed(() => this.croissant.state().persons);

  constructor(public croissant: CroissantService) {}

  openAddModal() {
    this.croissant.openAddModal();
  }

  editPerson(person: Person) {
    this.croissant.openEditModal(person);
  }

  deletePerson(person: Person) {
    this.croissant.deletePerson(person);
  }
}
