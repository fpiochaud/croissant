import { Component, signal, effect } from '@angular/core';
import { CroissantService, Person } from './croissant.service';

@Component({
  selector: 'croissant-modaux',
  imports: [],
  templateUrl: './croissant-modaux.html',
  styleUrl: './croissant-modaux.css',
})
export class CroissantModaux {
  // Signaux pour l'état des modaux
  showAddModal = signal(false);
  showEditModal = signal(false);
  editPerson: Person | null = null;
  color = signal('c1');

  constructor(public croissant: CroissantService) {
    // Effet pour fermer les modaux si la personne éditée n'existe plus
    effect(() => {
      if (this.editPerson && !this.croissant.state().persons.find(p => p.id === this.editPerson?.id)) {
        this.showEditModal.set(false);
        this.editPerson = null;
      }
    });
  }

  openAddModal() {
    this.showAddModal.set(true);
    setTimeout(() => {
      (document.getElementById('add-name') as HTMLInputElement)?.focus();
    }, 0);
  }

  openEditModal(person: Person) {
    this.editPerson = { ...person };
    this.color.set(person.color || 'c1');
    this.showEditModal.set(true);
    setTimeout(() => {
      (document.getElementById('edit-name') as HTMLInputElement)?.focus();
      (document.getElementById('edit-status') as HTMLSelectElement).value = person.status;
    }, 0);
  }

  closeModalOutside(event: MouseEvent, modalId: string) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showAddModal.set(false);
      this.showEditModal.set(false);
    }
  }

  selectColor(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (el.dataset['class']) {
      this.color.set(el.dataset['class']);
      document.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('selected'));
      el.classList.add('selected');
    }
  }

  addPerson() {
    const name = (document.getElementById('add-name') as HTMLInputElement)?.value.trim();
    const initials = (document.getElementById('add-initials') as HTMLInputElement)?.value.trim().toUpperCase();
    const color = this.color();
    if (!name || !initials) return;
    this.croissant.addPerson({ name, initials, color });
    this.showAddModal.set(false);
    (document.getElementById('add-name') as HTMLInputElement).value = '';
    (document.getElementById('add-initials') as HTMLInputElement).value = '';
    this.color.set('c1');
  }

  saveEdit() {
    if (!this.editPerson) return;
    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value.trim();
    const status = (document.getElementById('edit-status') as HTMLSelectElement)?.value as Person['status'];
    const color = this.color();
    if (!name) return;
    this.croissant.updatePerson({ ...this.editPerson, name, status, color });
    this.showEditModal.set(false);
    this.editPerson = null;
  }

  deletePerson() {
    if (this.editPerson) {
      this.croissant.deletePerson(this.editPerson);
      this.showEditModal.set(false);
      this.editPerson = null;
    }
  }
}
