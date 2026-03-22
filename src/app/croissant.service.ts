import { Injectable, signal } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, getDoc, getDocs,
  orderBy, query, where, limit, serverTimestamp, writeBatch, Firestore
} from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, onMessage, Messaging } from 'firebase/messaging';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, Auth, User
} from 'firebase/auth';
import { environment } from '../environments/environment';

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: 'ok' | 'absent' | 'catch';
  rank?: number;
  email?: string;
  replacedBy?: string | null;
  absentDate?: string | null;
  catchupDate?: string | null;
  promoted?: boolean | null;
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

function encodeEmail(email: string): string {
  return email.toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
}

// Retourne la date du lundi le plus récent qui est PASSÉ (si aujourd'hui est lundi, c'est le lundi d'avant)
function getMostRecentPastMonday(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0=dim, 1=lun, ..., 6=sam
  const daysBack = day === 0 ? 6 : day === 1 ? 7 : day - 1;
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysBack);
  return lastMonday.toISOString().split('T')[0];
}

// Retourne la date du prochain lundi (aujourd'hui si on est lundi)
export function getNextMonday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  if (day === 1) return today;
  const daysUntil = day === 0 ? 1 : 8 - day;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next;
}

@Injectable({ providedIn: 'root' })
export class CroissantService {
  private app: FirebaseApp;
  private db: Firestore;
  private auth: Auth;
  private messaging: Messaging | null = null;
  private currentFcmToken: string | null = null;
  private teamId = environment.teamId;
  private listenersInitialized = false;
  private rotationChecked = false;

  state = signal<AppState>({
    persons: [],
    notifPrefs: { eve: false, morning: false, swap: false },
    rules: { auto: true, catch: true, manual: false },
    history: [],
    teamName: '',
    notifications: [],
    currentIndex: 0,
  });

  darkMode    = signal<boolean>(localStorage.getItem('darkMode') === 'true');
  syncStatus  = signal<'syncing' | 'online' | 'offline'>('syncing');
  activeTab   = signal<'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params'>('rotation');
  showAddModal  = signal(false);
  showEditModal = signal(false);
  editPerson    = signal<Person | null>(null);
  fcmStatus     = signal<'idle' | 'pending' | 'granted' | 'denied'>('idle');

  // Auth
  currentUser = signal<User | null>(null);
  isAdmin     = signal(false);
  authStatus  = signal<'loading' | 'authenticated' | 'unauthenticated' | 'blocked'>('loading');
  authError   = signal<string | null>(null);

  constructor() {
    this.app  = initializeApp(environment.firebase);
    this.db   = getFirestore(this.app);
    this.auth = getAuth(this.app);
    // Applique le dark mode dès le démarrage (depuis localStorage) pour éviter le flash
    document.body.classList.toggle('dark', this.darkMode());
    this.initAuth();
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  private initAuth() {
    onAuthStateChanged(this.auth, async (user) => {
      if (!user) {
        this.currentUser.set(null);
        this.isAdmin.set(false);
        if (this.authStatus() !== 'blocked') {
          this.authStatus.set('unauthenticated');
        }
        return;
      }

      // Vérifier si l'utilisateur est en attente de suppression
      if (user.email) {
        const deletionSnap = await getDoc(doc(this.db, 'pendingDeletions', encodeEmail(user.email)));
        if (deletionSnap.exists()) {
          await signOut(this.auth);
          this.authStatus.set('blocked');
          this.authError.set('Vos accès ont été supprimés. Veuillez contacter un administrateur.');
          return;
        }
      }

      // Créer ou lire le profil utilisateur
      const userRef  = doc(this.db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let role = 'member';

      if (!userSnap.exists()) {
        await setDoc(userRef, { email: user.email, role: 'member', notifPrefs: { eve: true, morning: true, swap: true }, createdAt: serverTimestamp() });
        await this.addPersonFromEmail(user.email ?? '');
      } else {
        role = userSnap.data()?.['role'] ?? 'member';
      }

      this.currentUser.set(user);
      this.isAdmin.set(role === 'admin');
      this.authStatus.set('authenticated');

      if (!this.listenersInitialized) {
        this.listenersInitialized = true;
        this.initFirestoreListeners(user.uid);
        this.autoInitFCM();
      }
    });
  }

  async login(email: string, password: string): Promise<void> {
    this.authError.set(null);
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    location.reload();
  }

  // ── Modals ───────────────────────────────────────────────────────────────

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
      if (person.email) {
        const emailInput = document.getElementById('edit-email') as HTMLInputElement | null;
        if (emailInput) emailInput.value = person.email;
      }
    }, 0);
  }

  closeModals() {
    this.showAddModal.set(false);
    this.showEditModal.set(false);
  }

  // ── Firestore ─────────────────────────────────────────────────────────────

  private initFirestoreListeners(uid: string) {
    const teamDoc = doc(this.db, 'teams', this.teamId);

    // Préférences utilisateur (notifs + dark mode)
    onSnapshot(doc(this.db, 'users', uid), (snap) => {
      const data = snap.data() ?? {};
      const notifPrefs = data['notifPrefs'] ?? { eve: false, morning: false, swap: false };
      this.state.update(s => ({ ...s, notifPrefs }));
      if (data['darkMode'] !== undefined) {
        this.applyDarkMode(data['darkMode']);
      }
    });

    onSnapshot(teamDoc, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        this.state.update(s => ({
          ...s,
          teamName:     d['teamName']     ?? s.teamName,
          currentIndex: d['currentIndex'] ?? s.currentIndex,
          rules:        d['rules']        ?? s.rules,
        }));
      } else {
        setDoc(teamDoc, {
          teamName: 'Mon équipe',
          currentIndex: 0,
          rules: { auto: true, catch: true, manual: false },
        });
      }
      this.syncStatus.set('online');
    }, () => this.syncStatus.set('offline'));

    onSnapshot(
      query(collection(this.db, 'teams', this.teamId, 'persons'), orderBy('rank')),
      (snap) => {
        const persons = snap.docs.map(d => ({ id: d.id, ...d.data() } as Person));
        this.state.update(s => ({ ...s, persons }));
        if (!this.rotationChecked && persons.length > 0) {
          this.rotationChecked = true;
          this.checkAndRotate(persons);
        }
      }
    );

    onSnapshot(
      query(collection(this.db, 'teams', this.teamId, 'history'), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => {
        const history = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        this.state.update(s => ({ ...s, history }));
      }
    );

    onSnapshot(
      query(collection(this.db, 'teams', this.teamId, 'notifications'), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => {
        const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.state.update(s => ({ ...s, notifications }));
      }
    );
  }

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params') {
    this.activeTab.set(tab);
  }

  private applyDarkMode(value: boolean) {
    this.darkMode.set(value);
    document.body.classList.toggle('dark', value);
    localStorage.setItem('darkMode', String(value));
  }

  setDarkMode(value: boolean) {
    this.applyDarkMode(value);
    const uid = this.currentUser()?.uid;
    if (uid) updateDoc(doc(this.db, 'users', uid), { darkMode: value });
  }

  setNotifPref(pref: keyof AppState['notifPrefs'], value: boolean) {
    const notifPrefs = { ...this.state().notifPrefs, [pref]: value };
    this.state.update(s => ({ ...s, notifPrefs }));
    const uid = this.currentUser()?.uid;
    if (uid) updateDoc(doc(this.db, 'users', uid), { notifPrefs });
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

  setPersonAbsent(personId: string, replacedBy?: string) {
    // La date d'absence = date prévue de la personne selon son rang actuel
    const persons = this.state().persons;
    const idx = persons.findIndex(p => p.id === personId);
    const absentDate = new Date(getNextMonday());
    absentDate.setDate(absentDate.getDate() + idx * 7);
    const absentDateLabel = absentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    const catchupDateObj = new Date(absentDate);
    catchupDateObj.setDate(catchupDateObj.getDate() + 7);
    const catchupDateLabel = catchupDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    this.state.update(s => ({
      ...s,
      persons: s.persons.map(p => p.id === personId
        ? { ...p, status: 'absent', replacedBy: replacedBy ?? null, absentDate: absentDateLabel, catchupDate: catchupDateLabel }
        : p),
    }));
    updateDoc(doc(this.db, 'teams', this.teamId, 'persons', personId), {
      status: 'absent', replacedBy: replacedBy ?? null, absentDate: absentDateLabel, catchupDate: catchupDateLabel,
    });
  }

  // Quand l'absent est en tête de liste, on fait passer le remplaçant devant lui
  promoteReplacement(absentId: string, replacementId: string) {
    const persons = [...this.state().persons];
    if (persons[0]?.id !== absentId) return; // l'absent n'est pas premier, rien à faire

    const replacementIdx = persons.findIndex(p => p.id === replacementId);
    if (replacementIdx <= 0) return;

    const [replacement] = persons.splice(replacementIdx, 1);
    persons.unshift(replacement); // insère le remplaçant en position 0

    this.state.update(s => ({ ...s, persons: persons.map((p, i) => ({ ...p, rank: i })) }));

    const batch = writeBatch(this.db);
    persons.forEach((p, i) => {
      const update: any = { rank: i };
      if (p.id === absentId) update.promoted = true; // marque qu'il a été décalé
      batch.update(doc(this.db, 'teams', this.teamId, 'persons', p.id), update);
    });
    batch.commit();
  }

  setPersonOk(personId: string) {
    this.state.update(s => ({
      ...s,
      persons: s.persons.map(p => p.id === personId ? { ...p, status: 'ok' } : p),
    }));
    updateDoc(doc(this.db, 'teams', this.teamId, 'persons', personId), { status: 'ok' });
  }

  private async checkAndRotate(persons: Person[]) {
    const teamSnap = await getDoc(doc(this.db, 'teams', this.teamId));
    const lastRotationDate: string | null = teamSnap.data()?.['lastRotationDate'] ?? null;
    const mostRecentPastMonday = getMostRecentPastMonday();

    if (lastRotationDate && lastRotationDate >= mostRecentPastMonday) return;

    // Déplace le premier en bas de liste
    const updated = [...persons];
    const [first] = updated.splice(0, 1);
    updated.push(first);

    const batch = writeBatch(this.db);
    updated.forEach((p, i) => {
      const update: any = { rank: i };
      // Les absents passent en mode "rattrapage" (leur absentDate est conservé pour l'affichage)
      if (p.status === 'absent') {
        update.status = 'catch';
        update.replacedBy = null;
      }
      batch.update(doc(this.db, 'teams', this.teamId, 'persons', p.id), update);
    });
    batch.update(doc(this.db, 'teams', this.teamId), { lastRotationDate: mostRecentPastMonday });
    await batch.commit();

    // Purge de l'historique : on ne conserve que les 2 derniers mois
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oldHistorySnap = await getDocs(
      query(collection(this.db, 'teams', this.teamId, 'history'), where('timestamp', '<', sixMonthsAgo))
    );
    if (!oldHistorySnap.empty) {
      const purgeBatch = writeBatch(this.db);
      oldHistorySnap.docs.forEach(d => purgeBatch.delete(d.ref));
      await purgeBatch.commit();
    }
  }

  movePersonToTop(personId: string) {
    const persons = [...this.state().persons]; // déjà triés par rank
    const idx = persons.findIndex(p => p.id === personId);
    if (idx <= 0) return; // déjà en premier

    const [person] = persons.splice(idx, 1);
    persons.unshift(person);

    // Mise à jour locale immédiate
    this.state.update(s => ({
      ...s,
      persons: persons.map((p, i) => ({ ...p, rank: i })),
    }));

    // Écriture en batch dans Firestore
    const batch = writeBatch(this.db);
    persons.forEach((p, i) => {
      batch.update(doc(this.db, 'teams', this.teamId, 'persons', p.id), { rank: i });
    });
    batch.commit();
  }

  private async addPersonFromEmail(email: string) {
    if (!email) return;

    // Ne pas créer de doublon si un membre avec cet email existe déjà
    const existing = await getDocs(
      query(collection(this.db, 'teams', this.teamId, 'persons'), where('email', '==', email))
    );
    if (!existing.empty) return;

    // Dérive le nom et les initiales depuis l'email
    const prefix    = email.split('@')[0];
    const parts     = prefix.split(/[._-]/).filter(Boolean);
    const name      = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    const initials  = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : prefix.slice(0, 2).toUpperCase();

    // Rang = après le dernier de la liste
    const lastSnap = await getDocs(
      query(collection(this.db, 'teams', this.teamId, 'persons'), orderBy('rank', 'desc'), limit(1))
    );
    const rank = lastSnap.empty ? 0 : ((lastSnap.docs[0].data()['rank'] as number) ?? 0) + 1;

    await addDoc(collection(this.db, 'teams', this.teamId, 'persons'), {
      name, initials, color: 'c1', status: 'ok', rank, email,
      createdAt: serverTimestamp(),
    });
  }

  async addPerson(data: { name: string; initials: string; color: string; email?: string }) {
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

    // Bloquer l'accès si la personne a un email
    if (person.email) {
      setDoc(doc(this.db, 'pendingDeletions', encodeEmail(person.email)), {
        email: person.email,
        personName: person.name,
        requestedAt: serverTimestamp(),
      });
    }
  }

  // ── FCM ──────────────────────────────────────────────────────────────────

  private async autoInitFCM() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      await this.initFCM(true);
    }
  }

  async removeFCM(): Promise<void> {
    try {
      if (this.messaging) await deleteToken(this.messaging);
      if (this.currentFcmToken) {
        await deleteDoc(doc(this.db, 'teams', this.teamId, 'tokens', this.currentFcmToken.slice(0, 40)));
        this.currentFcmToken = null;
      }
    } catch (err) {
      console.error('FCM remove error:', err);
    }
    this.fcmStatus.set('idle');
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
        this.currentFcmToken = token;
        this.fcmStatus.set('granted');
        await setDoc(
          doc(this.db, 'teams', this.teamId, 'tokens', token.slice(0, 40)),
          { token, email: this.currentUser()?.email ?? null, updatedAt: serverTimestamp() }
        );
      }

      // onMessage intercepte les messages en premier plan — le service worker gère déjà l'affichage
      onMessage(this.messaging!, () => {});

    } catch (err) {
      console.error('FCM init error:', err);
      if (!silent) this.fcmStatus.set('denied');
    }
  }
}
