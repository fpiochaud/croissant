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

  canEdit(person: Person): boolean {
    return this.croissant.isAdmin() || person.email === this.croissant.currentUser()?.email;
  }

  editPerson(person: Person) {
    if (this.canEdit(person)) {
      this.croissant.openEditModal(person);
    }
  }

  deletePerson(person: Person) {
    this.croissant.personToDelete.set(person);
  }

  moveToTop(person: Person) {
    const offset = this.croissant.state().sessionOffset;
    if (new Date().getDay() === 1 + offset) {
      this.croissant.promoteBlocked.set(true);
    } else {
      this.croissant.personToPromote.set(person);
    }
  }

  isCurrentUser(person: Person): boolean {
    return person.email === this.croissant.currentUser()?.email;
  }

  isFirst(person: Person): boolean {
    return this.persons()[0]?.id === person.id;
  }
}
