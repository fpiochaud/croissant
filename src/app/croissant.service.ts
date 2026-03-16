import { Injectable, signal } from '@angular/core';

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: 'ok' | 'absent';
}

export interface AppState {
  persons: Person[];
  notifPrefs: { eve: boolean; morning: boolean; swap: boolean };
  rules: { auto: boolean; catch: boolean; manual: boolean };
  history: Array<{ date: string; type: string; details: any }>;
  teamName: string;
  notifications: any[];
  currentIndex: number;
}

@Injectable({ providedIn: 'root' })
export class CroissantService {
  state = signal<AppState>({
    persons: [],
    notifPrefs: { eve: false, morning: false, swap: false },
    rules: { auto: true, catch: true, manual: false },
    history: [],
    teamName: '',
    notifications: [],
    currentIndex: 0,
  });

  activeTab = signal<'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params'>('rotation');

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.activeTab.set(tab);
  }

  setState(updater: (s: AppState) => AppState) {
    this.state.set(updater(this.state()));
  }
  // Ajoute ici les méthodes pour manipuler l'état, synchroniser avec Firebase, etc.

  setNotifPref(pref: keyof AppState['notifPrefs'], value: boolean) {
    this.setState((s: AppState) => ({
      ...s,
      notifPrefs: { ...s.notifPrefs, [pref]: value },
    }));
  }

  addHistory(event: { date: string; type: string; details: any }) {
    this.setState((s: AppState) => ({
      ...s,
      history: [
        { ...event },
        ...s.history,
      ],
    }));
  }

  setPersonAbsent(personId: string) {
    this.setState((s: AppState) => ({
      ...s,
      persons: s.persons.map((p: Person) =>
        p.id === personId ? { ...p, status: 'absent' } : p
      ),
    }));
  }

  setPersonOk(personId: string) {
    this.setState((s: AppState) => ({
      ...s,
      persons: s.persons.map((p: Person) =>
        p.id === personId ? { ...p, status: 'ok' } : p
      ),
    }));
  }

  setRule(rule: keyof AppState['rules'], value: boolean) {
    this.setState((s: AppState) => ({
      ...s,
      rules: { ...s.rules, [rule]: value },
    }));
  }

  addPerson(data: { name: string; initials: string; color: string }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const person: Person = {
      id,
      name: data.name,
      initials: data.initials,
      color: data.color,
      status: 'ok',
    };
    this.setState((s: AppState) => ({
      ...s,
      persons: [...s.persons, person],
    }));
  }

  updatePerson(person: Person) {
    this.setState((s: AppState) => ({
      ...s,
      persons: s.persons.map((p: Person) => (p.id === person.id ? person : p)),
    }));
  }

  deletePerson(person: Person) {
    this.setState((s: AppState) => ({
      ...s,
      persons: s.persons.filter((p: Person) => p.id !== person.id),
    }));
  }
}
