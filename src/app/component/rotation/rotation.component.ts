import { Component, computed } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { CroissantService, Person } from '../../croissant.service';
import { computePersonsWithDates } from '../../rotation-logic';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor, NgClass],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  persons = computed(() => this.croissant.state().persons);

  personsWithDates = computed(() =>
    computePersonsWithDates(this.persons(), this.croissant.state().sessionOffset)
  );

  constructor(public croissant: CroissantService) {}

  openAddModal() {
    this.croissant.openAddModal();
  }

  editPerson(person: Person) {
    if (this.isCurrentUser(person)) {
      this.croissant.openEditModal(person);
    }
  }

  isCurrentUser(person: Person): boolean {
    return person.email === this.croissant.currentUser()?.email;
  }
}
