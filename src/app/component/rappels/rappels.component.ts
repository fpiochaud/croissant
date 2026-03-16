import { Component, computed } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-rappels',
  imports: [],
  templateUrl: './rappels.component.html',
  styleUrl: './rappels.component.css',
})
export class RappelsComponent {
  notifPrefs = computed(() => this.croissant.state().notifPrefs);
  notifications = computed(() => this.croissant.state().notifications);
  fcmEnabled = false;

  constructor(public croissant: CroissantService) {}

  requestFCMPermission() {
    this.fcmEnabled = true;
    alert('Notifications push activées (simulation)');
  }

  toggleNotif(pref: 'eve' | 'morning' | 'swap') {
    this.croissant.setNotifPref(pref, !this.notifPrefs()[pref]);
  }
}
