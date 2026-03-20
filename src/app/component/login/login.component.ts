import { Component, inject, signal } from '@angular/core';
import { CroissantService } from '../../croissant.service';

@Component({
  selector: 'croissant-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  croissant = inject(CroissantService);
  loading = signal(false);
  error   = signal<string | null>(null);

  async login(email: string, password: string) {
    if (!email || !password) {
      this.error.set('Veuillez renseigner votre email et mot de passe.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.croissant.login(email, password);
    } catch (err: any) {
      this.loading.set(false);
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        this.error.set('Email ou mot de passe incorrect.');
      } else if (code === 'auth/too-many-requests') {
        this.error.set('Trop de tentatives. Réessayez dans quelques minutes.');
      } else if (code === 'auth/user-disabled') {
        this.error.set('Ce compte a été désactivé.');
      } else {
        this.error.set('Erreur de connexion. Veuillez réessayer.');
      }
    }
  }

  onKeydown(event: KeyboardEvent, email: string, password: string) {
    if (event.key === 'Enter') this.login(email, password);
  }
}
