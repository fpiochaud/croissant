import { Component, computed } from '@angular/core';
import { NgFor } from '@angular/common';
import { CroissantService, Person, getNextMonday } from '../../croissant.service';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  persons = computed(() => this.croissant.state().persons);

  personsWithDates = computed(() => {
    const nextMonday = getNextMonday();
    return this.persons().map((person, index) => {
      const date = new Date(nextMonday);
      date.setDate(date.getDate() + index * 7);
      const label = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      return { ...person, dateLabel: label };
    });
  });

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
    this.croissant.deletePerson(person);
  }

  moveToTop(person: Person) {
    this.croissant.movePersonToTop(person.id);
  }

  isCurrentUser(person: Person): boolean {
    return person.email === this.croissant.currentUser()?.email;
  }

  isFirst(person: Person): boolean {
    return this.persons()[0]?.id === person.id;
  }
}
