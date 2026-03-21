import { Component, computed, signal, HostListener } from '@angular/core';
import { NgIf } from '@angular/common';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-header',
  imports: [NgIf],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  teamName = computed(() => this.croissant.state().teamName);
  nextName = computed(() => {
    const s = this.croissant.state();
    return s.persons[s.currentIndex]?.name ?? '—';
  });
  nextDate = computed(() => '—');
  isNextUser = computed(() => false);
  showDropdown = signal(false);

  constructor(public croissant: CroissantService) {}

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown.update(v => !v);
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
