import { Component, computed, signal, HostListener, inject } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { CroissantService, getNextCroissantDay } from '../../croissant.service';

@Component({
  selector: 'croissant-header',
  imports: [NgIf, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  croissant = inject(CroissantService);

  teamName   = computed(() => this.croissant.state().teamName);
  nextPerson = computed(() => this.croissant.state().persons[0] ?? null);
  nextName   = computed(() => this.nextPerson()?.name ?? '—');
  nextInitials = computed(() => this.nextPerson()?.initials ?? '?');
  nextColor  = computed(() => this.nextPerson()?.color ?? '');
  nextDate   = computed(() => {
    const person = this.nextPerson();
    if (!person) return '—';
    return getNextCroissantDay(0).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  });

  offsetLabel = computed(() => {
    const offset = this.croissant.state().sessionOffset;
    if (offset === 0) return null;
    const date = getNextCroissantDay(offset).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `Férié ou chômé — décalé le ${date}`;
  });
  isNextUser = computed(() => this.nextPerson()?.email === this.croissant.currentUser()?.email);
  showDropdown = signal(false);
  darkMode = this.croissant.darkMode;

  toggleDarkMode() {
    this.croissant.setDarkMode(!this.darkMode());
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown.update((v: boolean) => !v);
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showDropdown.set(false);
  }

  reload() {
    window.location.reload();
  }

  logout() {
    this.showDropdown.set(false);
    this.croissant.logout();
  }
}
