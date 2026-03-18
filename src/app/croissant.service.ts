import { Injectable, signal } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, updateDoc, addDoc, deleteDoc,
  orderBy, query, limit, serverTimestamp, Firestore
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../environments/environment';

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: 'ok' | 'absent' | 'catch';
  rank?: number;
}

export interface AppState {
  persons: Person[];
  notifPrefs: { eve: boolean; morning: boolean; swap: boolean };
  rules: { auto: boolean; catch: boolean; manual: boolean };
  history: Array<{ id?: string; date: string; type: string; details: any }>;
  teamName: string;
  notifications: any[];
  currentIndex: number;
}

@Injectable({ providedIn: 'root' })
export class CroissantService {
  private app: FirebaseApp;
  private db: Firestore;
  private messaging: Messaging | null = null;
  private teamId = environment.teamId;

  state = signal<AppState>({
    persons: [],
    notifPrefs: { eve: false, morning: false, swap: false },
    rules: { auto: true, catch: true, manual: false },
    history: [],
    teamName: '',
    notifications: [],
    currentIndex: 0,
  });

  syncStatus = signal<'syncing' | 'online' | 'offline'>('syncing');
  activeTab = signal<'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params'>('rotation');
  showAddModal = signal(false);
  showEditModal = signal(false);
  editPerson = signal<Person | null>(null);
  fcmStatus = signal<'idle' | 'pending' | 'granted' | 'denied'>('idle');

  openAddModal() {
    this.showAddModal.set(true);
    setTimeout(() => (document.getElementById('add-name') as HTMLInputElement)?.focus(), 0);
  }

  openEditModal(person: Person) {
    this.editPerson.set({ ...person });
    this.showEditModal.set(true);
    setTimeout(() => {
      (document.getElementById('edit-name') as HTMLInputElement)?.focus();
      (document.getElementById('edit-status') as HTMLSelectElement | null)?.setAttribute('value', person.status);
    }, 0);
  }

  closeModals() {
    this.showAddModal.set(false);
    this.showEditModal.set(false);
  }

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
    this.initFirestoreListeners();
    this.autoInitFCM();
  }

  // Si la permission est déjà accordée (utilisateur revient sur l'app), on rafraîchit le token silencieusement
  private async autoInitFCM() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      await this.initFCM(true);
    }
  }

  async initFCM(silent = false): Promise<void> {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      if (!silent) this.fcmStatus.set('denied');
      return;
    }

    if (!silent) this.fcmStatus.set('pending');

    try {
      const permission = silent ? Notification.permission : await Notification.requestPermission();
      if (permission !== 'granted') {
        this.fcmStatus.set('denied');
        return;
      }

      if (!this.messaging) {
        this.messaging = getMessaging(this.app);
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

      const token = await getToken(this.messaging, {
        vapidKey: environment.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        this.fcmStatus.set('granted');
        // Stocke le token dans Firestore (upsert par tranche du token)
        await setDoc(
          doc(this.db, 'teams', this.teamId, 'tokens', token.slice(0, 40)),
          { token, updatedAt: serverTimestamp() }
        );
      }

      // Gère les messages reçus quand l'app est au premier plan
      onMessage(this.messaging!, (payload) => {
        const title = payload.notification?.title ?? '🥐 Croissants du lundi';
        const body  = payload.notification?.body  ?? '';
        new Notification(title, { body, icon: '/favicon.ico' });
      });

    } catch (err) {
      console.error('FCM init error:', err);
      if (!silent) this.fcmStatus.set('denied');
    }
  }

  private initFirestoreListeners() {
    const teamDoc = doc(this.db, 'teams', this.teamId);

    // Document principal (teamName, currentIndex, rules)
    onSnapshot(teamDoc, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        this.state.update(s => ({
          ...s,
          teamName: d['teamName'] ?? s.teamName,
          currentIndex: d['currentIndex'] ?? s.currentIndex,
          rules: d['rules'] ?? s.rules,
          notifPrefs: d['notifPrefs'] ?? s.notifPrefs,
        }));
      } else {
        // Crée le document si inexistant
        setDoc(teamDoc, {
          teamName: 'Mon équipe',
          currentIndex: 0,
          rules: { auto: true, catch: true, manual: false },
          notifPrefs: { eve: false, morning: false, swap: false },
        });
      }
      this.syncStatus.set('online');
    }, () => this.syncStatus.set('offline'));

    // Persons
    const personsQuery = query(
      collection(this.db, 'teams', this.teamId, 'persons'),
      orderBy('rank')
    );
    onSnapshot(personsQuery, (snap) => {
      const persons = snap.docs.map(d => ({ id: d.id, ...d.data() } as Person));
      this.state.update(s => ({ ...s, persons }));
    });

    // History
    const historyQuery = query(
      collection(this.db, 'teams', this.teamId, 'history'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    onSnapshot(historyQuery, (snap) => {
      const history = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      this.state.update(s => ({ ...s, history }));
    });

    // Notifications
    const notifsQuery = query(
      collection(this.db, 'teams', this.teamId, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    onSnapshot(notifsQuery, (snap) => {
      const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.state.update(s => ({ ...s, notifications }));
    });
  }

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.activeTab.set(tab);
  }

  setNotifPref(pref: keyof AppState['notifPrefs'], value: boolean) {
    const notifPrefs = { ...this.state().notifPrefs, [pref]: value };
    this.state.update(s => ({ ...s, notifPrefs }));
    updateDoc(doc(this.db, 'teams', this.teamId), { notifPrefs });
  }

  setRule(rule: keyof AppState['rules'], value: boolean) {
    const rules = { ...this.state().rules, [rule]: value };
    this.state.update(s => ({ ...s, rules }));
    updateDoc(doc(this.db, 'teams', this.teamId), { rules });
  }

  async addHistory(event: { date: string; type: string; details: any }) {
    this.state.update(s => ({ ...s, history: [event, ...s.history] }));
    await addDoc(collection(this.db, 'teams', this.teamId, 'history'), {
      ...event,
      timestamp: serverTimestamp(),
    });
  }

  setPersonAbsent(personId: string) {
    this.state.update(s => ({
      ...s,
      persons: s.persons.map(p => p.id === personId ? { ...p, status: 'absent' } : p),
    }));
    updateDoc(doc(this.db, 'teams', this.teamId, 'persons', personId), { status: 'absent' });
  }

  setPersonOk(personId: string) {
    this.state.update(s => ({
      ...s,
      persons: s.persons.map(p => p.id === personId ? { ...p, status: 'ok' } : p),
    }));
    updateDoc(doc(this.db, 'teams', this.teamId, 'persons', personId), { status: 'ok' });
  }

  async addPerson(data: { name: string; initials: string; color: string }) {
    const rank = this.state().persons.length;
    await addDoc(collection(this.db, 'teams', this.teamId, 'persons'), {
      ...data,
      status: 'ok',
      rank,
      createdAt: serverTimestamp(),
    });
  }

  updatePerson(person: Person) {
    this.state.update(s => ({
      ...s,
      persons: s.persons.map(p => p.id === person.id ? person : p),
    }));
    const { id, ...data } = person;
    updateDoc(doc(this.db, 'teams', this.teamId, 'persons', id), { ...data });
  }

  deletePerson(person: Person) {
    this.state.update(s => ({
      ...s,
      persons: s.persons.filter(p => p.id !== person.id),
    }));
    deleteDoc(doc(this.db, 'teams', this.teamId, 'persons', person.id));
  }
}
