import { Component, inject, signal, computed } from '@angular/core';
import { CroissantService } from './croissant.service';
import { LoginComponent } from './component/login/login.component';
import { HeaderComponent } from './component/header/header.component';
import { SyncBarComponent } from './component/sync-bar/sync-bar.component';
import { NavigationComponent } from './component/navigation/navigation.component';
import { RotationComponent } from './component/rotation/rotation.component';
import { RemplacementComponent } from './component/remplacement/remplacement.component';
import { HistoriqueComponent } from './component/historique/historique.component';
import { RappelsComponent } from './component/rappels/rappels.component';
import { ParametresComponent } from './component/parametres/parametres.component';
import { ModauxComponent } from './component/modaux/modaux.component';

const TABS = ['rotation', 'remplacement', 'historique', 'rappels', 'params'] as const;
type Tab = typeof TABS[number];

@Component({
  selector: 'app-root',
  imports: [
    LoginComponent, HeaderComponent, SyncBarComponent, NavigationComponent,
    RotationComponent, RemplacementComponent, HistoriqueComponent,
    RappelsComponent, ParametresComponent, ModauxComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  croissant = inject(CroissantService);

  private touchStartX  = 0;
  private touchStartY  = 0;
  private swipeDir: 'h' | 'v' | null = null;

  private dragOffset = signal(0);
  isDragging         = signal(false);
  noTransition       = signal(false);

  private tabIndex = computed(() => TABS.indexOf(this.croissant.activeTab() as Tab));

  trackTransform = computed(() =>
    `translateX(calc(${-this.tabIndex() * 100}% + ${this.dragOffset()}px))`
  );

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.swipeDir    = null;
    this.dragOffset.set(0);
  }

  // Avec touch-action:pan-y sur le viewport, le navigateur gère le scroll vertical
  // nativement et nous envoie les touchmove sans qu'on ait besoin de preventDefault.
  onTouchMove(e: TouchEvent): void {
    const dx = e.touches[0].clientX - this.touchStartX;
    const dy = e.touches[0].clientY - this.touchStartY;

    if (this.swipeDir === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      this.swipeDir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }

    if (this.swipeDir === 'v') return;

    this.isDragging.set(true);
    this.dragOffset.set(dx);
  }

  onTouchEnd(): void {
    if (!this.isDragging()) { this.reset(); return; }

    const offset    = this.dragOffset();
    const threshold = window.innerWidth * 0.2;
    const idx       = this.tabIndex();

    this.isDragging.set(false);
    this.dragOffset.set(0);

    if (Math.abs(offset) >= threshold) {
      const nextIdx = offset < 0
        ? (idx + 1) % TABS.length
        : (idx - 1 + TABS.length) % TABS.length;

      const isWrap = (offset < 0 && idx === TABS.length - 1)
                  || (offset > 0 && idx === 0);

      if (isWrap) {
        this.noTransition.set(true);
        this.croissant.openTab(TABS[nextIdx]);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => this.noTransition.set(false))
        );
      } else {
        this.croissant.openTab(TABS[nextIdx]);
      }
    }

    this.reset();
  }

  private reset(): void {
    this.isDragging.set(false);
    this.dragOffset.set(0);
    this.swipeDir = null;
  }
}
