import { Component, computed } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { CroissantService, Person } from '../../croissant.service';
import { computePersonsWithDates, PersonWithDate } from '../../rotation-logic';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor, NgClass],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  persons = computed(() => this.croissant.state().persons);

  personsWithDates = computed<(PersonWithDate & { isAdmin: boolean })[]>(() => {
    const adminEmails = new Set(
      this.croissant.users().filter(u => u.role === 'admin').map(u => u.email)
    );
    return computePersonsWithDates(this.persons(), this.croissant.state().sessionOffset)
      .map(person => ({ ...person, isAdmin: !!person.email && adminEmails.has(person.email) }));
  });

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
