import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './component/header/header.component';
import { SyncBarComponent } from './component/sync-bar/sync-bar.component';
import { NavigationComponent } from './component/navigation/navigation.component';
import { RotationComponent } from './component/rotation/rotation.component';
import { RemplacementComponent } from './component/remplacement/remplacement.component';
import { HistoriqueComponent } from './component/historique/historique.component';
import { RappelsComponent } from './component/rappels/rappels.component';
import { ParametresComponent } from './component/parametres/parametres.component';
import { ModauxComponent } from './component/modaux/modaux.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    SyncBarComponent,
    NavigationComponent,
    RotationComponent,
    RemplacementComponent,
    HistoriqueComponent,
    RappelsComponent,
    ParametresComponent,
    ModauxComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('croissant-angular');
}
