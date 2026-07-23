import { Component, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { CroissantService, Person, UserProfile } from '../../croissant.service';
import { APP_VERSION } from '../../../version';
import { environment } from '../../../environments/environment';

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

  // Bouton de test réservé au mode dev, pour ne pas attendre le jour J
  // à chaque itération sur le workflow de remplacement.
  isDev = !environment.production;

  draggedId = signal<string | null>(null);

  // Ordre visuel pendant le drag (réordonné en direct dès qu'un voisin est
  // dépassé de plus de la moitié). Null quand aucun drag n'est en cours,
  // auquel cas l'ordre affiché est celui de `rows()`.
  private dragOrderIds = signal<string[] | null>(null);

  displayRows = computed<AdminRow[]>(() => {
    const order = this.dragOrderIds();
    const all = this.rows();
    if (!order) return all;

    const byId = new Map(all.map(r => [r.id, r]));
    const reordered = order.map(id => byId.get(id)).filter((r): r is AdminRow => !!r);
    return reordered.length === all.length ? reordered : all;
  });

  private dragCard: HTMLElement | null = null;
  private dragStartY = 0;
  private dragCenterY = 0;
  private dragHeight = 0;
  // Compense le décalage de position dans le flux causé par les swaps de
  // voisins, pour que la carte continue de suivre le curseur sans saut
  // (translateY appliqué = delta du curseur - décalage cumulé du flux).
  private flowShift = 0;
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = () => this.handlePointerUp();

  rotating = signal(false);

  constructor(public croissant: CroissantService) {}

  async forceRotation() {
    if (this.rotating()) return;
    this.rotating.set(true);
    try {
      await this.croissant.forceRotation();
    } finally {
      this.rotating.set(false);
    }
  }

  // Drag vertical uniquement : on ignore l'axe X et on déplace la carte
  // via transform pour garder le contrôle du mouvement (le drag HTML5
  // natif suit le curseur sur les deux axes et ne peut pas être contraint).
  onHandlePointerDown(event: PointerEvent, id: string) {
    const card = (event.currentTarget as HTMLElement).closest<HTMLElement>('.admin-card');
    if (!card) return;
    event.preventDefault();

    const rect = card.getBoundingClientRect();
    this.dragCard = card;
    this.dragStartY = event.clientY;
    this.dragCenterY = rect.top + rect.height / 2;
    this.dragHeight = rect.height;
    this.flowShift = 0;
    this.dragOrderIds.set(this.rows().map(r => r.id));
    this.draggedId.set(id);

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.dragCard) return;

    const deltaY = event.clientY - this.dragStartY;
    this.dragCard.style.transform = `translateY(${deltaY - this.flowShift}px)`;

    const visualCenterY = this.dragCenterY + deltaY;
    // On compare le bord de la carte déplacée (dans le sens du mouvement)
    // au milieu de la carte voisine, pas centre à centre : le swap doit se
    // déclencher dès que la carte déplacée atteint la moitié de la carte
    // cible, pas seulement quand elle la recouvre presque entièrement.
    const visualTopY = visualCenterY - this.dragHeight / 2;
    const visualBottomY = visualCenterY + this.dragHeight / 2;
    const order = this.dragOrderIds();
    const draggedId = this.draggedId();
    if (!order || !draggedId) return;
    const index = order.indexOf(draggedId);
    if (index === -1) return;

    if (index < order.length - 1) {
      const belowEl = this.findCardEl(order[index + 1]);
      const belowRect = belowEl?.getBoundingClientRect();
      if (belowRect && visualBottomY > belowRect.top + belowRect.height / 2) {
        this.swap(order, index, index + 1, this.outerHeight(belowEl!, belowRect));
        return;
      }
    }

    if (index > 0) {
      const aboveEl = this.findCardEl(order[index - 1]);
      const aboveRect = aboveEl?.getBoundingClientRect();
      if (aboveRect && visualTopY < aboveRect.top + aboveRect.height / 2) {
        this.swap(order, index, index - 1, -this.outerHeight(aboveEl!, aboveRect));
      }
    }
  }

  private findCardEl(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.admin-card[data-row-id="${CSS.escape(id)}"]`);
  }

  private outerHeight(el: HTMLElement, rect: DOMRect): number {
    return rect.height + parseFloat(getComputedStyle(el).marginBottom || '0');
  }

  private swap(order: string[], fromIndex: number, toIndex: number, flowDelta: number) {
    const next = order.slice();
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    this.dragOrderIds.set(next);
    this.flowShift += flowDelta;
  }

  private handlePointerUp() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    if (this.dragCard) {
      this.dragCard.style.transform = '';
      this.dragCard = null;
    }

    const finalOrder = this.dragOrderIds();
    this.draggedId.set(null);
    this.dragOrderIds.set(null);
    if (!finalOrder) return;

    const originalOrder = this.rows().map(r => r.id);
    const changed = finalOrder.some((id, i) => id !== originalOrder[i]);
    if (changed) this.croissant.reorderPersons(finalOrder);
  }
}
