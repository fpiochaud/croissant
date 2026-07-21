import { Component, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { CroissantService, Person, UserProfile } from '../../croissant.service';
import { APP_VERSION } from '../../../version';

interface AdminRow extends Person {
  role: string;
  lastLoginLabel: string;
  appVersion: string | null;
  isStaleVersion: boolean;
  hasAccount: boolean;
}

function formatLastLogin(ts: any): string {
  if (!ts?.toDate) return 'Jamais connecté';
  return (ts.toDate() as Date).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

@Component({
  selector: 'croissant-admin',
  imports: [NgClass],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  rows = computed<AdminRow[]>(() => {
    const usersByEmail = new Map<string, UserProfile>();
    for (const u of this.croissant.users()) {
      if (u.email) usersByEmail.set(u.email, u);
    }

    // Déjà trié par rank (croissant.state().persons vient d'une query orderBy('rank')).
    return this.croissant.state().persons.map(person => {
      const account = person.email ? usersByEmail.get(person.email) : undefined;
      return {
        ...person,
        role: account?.role ?? 'member',
        lastLoginLabel: formatLastLogin(account?.lastLogin),
        appVersion: account?.appVersion ?? null,
        isStaleVersion: !!account?.appVersion && account.appVersion !== APP_VERSION,
        hasAccount: !!account,
      };
    });
  });

  currentVersion = APP_VERSION;

  private draggedId: string | null = null;
  dragOverId: string | null = null;

  constructor(public croissant: CroissantService) {}

  onDragStart(id: string) {
    this.draggedId = id;
  }

  onDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    if (id !== this.draggedId) this.dragOverId = id;
  }

  onDragLeave(id: string) {
    if (this.dragOverId === id) this.dragOverId = null;
  }

  onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    this.dragOverId = null;
    const draggedId = this.draggedId;
    this.draggedId = null;
    if (!draggedId || draggedId === targetId) return;

    const ids = this.rows().map(r => r.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    this.croissant.reorderPersons(ids);
  }

  onDragEnd() {
    this.draggedId = null;
    this.dragOverId = null;
  }
}
