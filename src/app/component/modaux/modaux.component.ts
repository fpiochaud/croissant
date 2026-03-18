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
  color = signal('c1');

  constructor() {
    effect(() => {
      const ep = this.editPerson();
      if (ep && !this.croissant.state().persons.find(p => p.id === ep.id)) {
        this.croissant.closeModals();
        this.croissant.editPerson.set(null);
      }
    });
  }

  closeModalOutside(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.croissant.closeModals();
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
    this.croissant.showAddModal.set(false);
    (document.getElementById('add-name') as HTMLInputElement).value = '';
    (document.getElementById('add-initials') as HTMLInputElement).value = '';
    this.color.set('c1');
  }

  saveEdit() {
    const ep = this.editPerson();
    if (!ep) return;
    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value.trim();
    const status = (document.getElementById('edit-status') as HTMLSelectElement)?.value as Person['status'];
    const color = this.color();
    if (!name) return;
    this.croissant.updatePerson({ ...ep, name, status, color });
    this.croissant.closeModals();
    this.croissant.editPerson.set(null);
  }

  deletePerson() {
    const ep = this.editPerson();
    if (ep) {
      this.croissant.deletePerson(ep);
      this.croissant.closeModals();
      this.croissant.editPerson.set(null);
    }
  }

  confirmManualSwap() {
    this.croissant.closeModals();
  }
}
