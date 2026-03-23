import { Component, signal, effect, inject } from '@angular/core';
import { CroissantService, Person } from '../../croissant.service';

@Component({
  selector: 'croissant-modaux',
  imports: [],
  templateUrl: './modaux.component.html',
  styleUrl: './modaux.component.css',
})
export class ModauxComponent {
  croissant = inject(CroissantService);
  showAddModal = this.croissant.showAddModal;
  showEditModal = this.croissant.showEditModal;
  editPerson = this.croissant.editPerson;
  personToDelete = this.croissant.personToDelete;
  color = signal('c1');

  constructor() {
    // Ferme la modal si la personne éditée a été supprimée
    effect(() => {
      const ep = this.editPerson();
      if (ep && !this.croissant.state().persons.find(p => p.id === ep.id)) {
        this.croissant.closeModals();
        this.croissant.editPerson.set(null);
      }
    });

    // Pré-remplit les champs et la couleur à l'ouverture de la modal edit
    effect(() => {
      const ep = this.editPerson();
      if (ep && this.showEditModal()) {
        this.color.set(ep.color ?? 'c1');
        setTimeout(() => {
          const nameInput = document.getElementById('edit-name') as HTMLInputElement | null;
          if (nameInput) nameInput.value = ep.name;
          const initialsInput = document.getElementById('edit-initials') as HTMLInputElement | null;
          if (initialsInput) initialsInput.value = ep.initials ?? '';
          const emailInput = document.getElementById('edit-email') as HTMLInputElement | null;
          if (emailInput) emailInput.value = ep.email ?? '';
          const statusSelect = document.getElementById('edit-status') as HTMLSelectElement | null;
          if (statusSelect) statusSelect.value = ep.status === 'absent' ? 'absent' : 'disponible';
          document.querySelectorAll('#edit-color-picker .color-dot').forEach(dot => dot.classList.remove('selected'));
          document.querySelector(`#edit-color-picker .${ep.color}`)?.classList.add('selected');
        }, 0);
      }
    });
  }

  closeModalOutside(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.croissant.personToDelete.set(null);
      this.croissant.closeModals();
    }
  }

  selectColor(event: MouseEvent) {
    const el = event.target as HTMLElement;
    if (el.dataset['class']) {
      this.color.set(el.dataset['class']);
      el.closest('.color-picker')?.querySelectorAll('.color-dot').forEach(dot => dot.classList.remove('selected'));
      el.classList.add('selected');
    }
  }

  addPerson() {
    const name     = (document.getElementById('add-name') as HTMLInputElement)?.value.trim();
    const initials = (document.getElementById('add-initials') as HTMLInputElement)?.value.trim().toUpperCase();
    const email    = (document.getElementById('add-email') as HTMLInputElement)?.value.trim().toLowerCase();
    const color    = this.color();
    if (!name || !initials) return;
    this.croissant.addPerson({ name, initials, color, ...(email ? { email } : {}) });
    this.croissant.showAddModal.set(false);
    (document.getElementById('add-name') as HTMLInputElement).value = '';
    (document.getElementById('add-initials') as HTMLInputElement).value = '';
    (document.getElementById('add-email') as HTMLInputElement).value = '';
    this.color.set('c1');
  }

  canEditStatus(): boolean {
    const ep = this.editPerson();
    if (!ep) return false;
    return this.croissant.isAdmin() || this.croissant.currentUser()?.email === ep.email;
  }

  saveEdit() {
    const ep = this.editPerson();
    if (!ep) return;
    const name     = (document.getElementById('edit-name') as HTMLInputElement)?.value.trim();
    const initials = (document.getElementById('edit-initials') as HTMLInputElement)?.value.trim().toUpperCase();
    const email    = (document.getElementById('edit-email') as HTMLInputElement)?.value.trim().toLowerCase();
    const statusVal = (document.getElementById('edit-status') as HTMLSelectElement)?.value;
    const color    = this.color();
    if (!name || !initials || !email) return;

    let status: Person['status'] = ep.status;
    if (this.canEditStatus()) {
      if (statusVal === 'absent') {
        status = 'absent';
      } else if (ep.status === 'absent' || ep.status === 'catch') {
        status = 'ok';
      }
    }

    const updated: Person = { ...ep, name, initials, status, color, email };
    if (status === 'ok') {
      updated.replacedBy = null;
      updated.absentDate = null;
      updated.catchupDate = null;
      updated.promoted = null;
    }
    if (!this.croissant.isAdmin()) delete (updated as any).email;
    this.croissant.updatePerson(updated);
    this.croissant.closeModals();
    this.croissant.editPerson.set(null);
  }

  deletePerson() {
    const ep = this.editPerson();
    if (ep) this.croissant.personToDelete.set(ep);
  }

  confirmDelete() {
    const person = this.personToDelete();
    if (!person) return;
    this.croissant.deletePerson(person);
    this.croissant.personToDelete.set(null);
    this.croissant.closeModals();
    this.croissant.editPerson.set(null);
  }

  cancelDelete() {
    this.croissant.personToDelete.set(null);
  }

  confirmManualSwap() {
    this.croissant.closeModals();
  }
}
