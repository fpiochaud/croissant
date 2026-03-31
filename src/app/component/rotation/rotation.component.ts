import { Component, computed } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { CroissantService, Person, getNextCroissantDay } from '../../croissant.service';

@Component({
  selector: 'croissant-rotation',
  imports: [NgFor, NgClass],
  templateUrl: './rotation.component.html',
  styleUrl: './rotation.component.css',
})
export class RotationComponent {
  persons = computed(() => this.croissant.state().persons);

  personsWithDates = computed(() => {
    const offset = this.croissant.state().sessionOffset;
    const nextMonday = getNextCroissantDay(0);
    const persons = this.persons();

    // Calcul des dates brutes (un lundi par semaine, + offset uniquement pour le 1er)
    const rawDates = persons.map((_, i) => {
      const d = new Date(nextMonday);
      d.setDate(d.getDate() + i * 7 + (i === 0 ? offset : 0));
      return d;
    });

    return persons.map((person, index) => {
      // Cascade récursive : remonter tous les absents consécutifs pour trouver
      // le premier slot disponible. Exemple : [A(absent), B(absent), C] → C hérite
      // du slot de A, pas du slot de B.
      let slot = index;
      while (slot > 0 && persons[slot - 1].status === 'absent' && !persons[slot - 1].replacedBy) {
        slot--;
      }
      const date = rawDates[slot];
      const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
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
