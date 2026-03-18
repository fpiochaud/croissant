import { Component, computed, inject } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-rappels',
  imports: [],
  templateUrl: './rappels.component.html',
  styleUrl: './rappels.component.css',
})
export class RappelsComponent {
  croissant = inject(CroissantService);
  notifPrefs = computed(() => this.croissant.state().notifPrefs);
  fcmStatus = this.croissant.fcmStatus;

  async requestFCMPermission() {
    await this.croissant.initFCM();
  }

  toggleNotif(pref: 'eve' | 'morning' | 'swap') {
    this.croissant.setNotifPref(pref, !this.notifPrefs()[pref]);
  }
}
