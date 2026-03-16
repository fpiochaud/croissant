import { Component, computed } from '@angular/core';
import { CroissantService } from './croissant.service';

@Component({
  selector: 'croissant-rappels',
  imports: [],
  templateUrl: './croissant-rappels.html',
  styleUrl: './croissant-rappels.css',
})
export class CroissantRappels {
  notifPrefs = computed(() => this.croissant.state().notifPrefs);
  notifications = computed(() => this.croissant.state().notifications);
  fcmEnabled = false;

  constructor(public croissant: CroissantService) {}

  requestFCMPermission() {
    // Simulation d'activation FCM
    this.fcmEnabled = true;
    alert('Notifications push activées (simulation)');
  }

  toggleNotif(pref: 'eve' | 'morning' | 'swap') {
    this.croissant.setNotifPref(pref, !this.notifPrefs()[pref]);
  }
}
