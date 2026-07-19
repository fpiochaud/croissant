import { Injectable, signal } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, getDoc, getDocFromServer, getDocs,
  orderBy, query, where, limit, serverTimestamp, writeBatch, Firestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, onMessage, Messaging } from 'firebase/messaging';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, Auth, User, connectAuthEmulator,
} from 'firebase/auth';
import { environment } from '../environments/environment';
import { APP_VERSION } from '../version';
import {
  Person, getNextCroissantDay, computeEventDate, shouldRotate, rotateOnce, eventDateLabel,
  reorderForReplacement, computeAbsentDates, derivePersonFromEmail,
} from './rotation-logic';

export type { Person };
export { getNextCroissantDay };

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  lastLogin?: any;
  appVersion?: string;
}

export interface AppState {
  persons: Person[];
  notifPrefs: { eve: boolean; morning: boolean; swap: boolean };
  rules: { auto: boolean; catch: boolean; manual: boolean };
  history: Array<{ id?: string; date: string; type: string; details: any }>;
  teamName: string;
  notifications: any[];
  currentIndex: number;
  sessionOffset: number; // 0=lundi, 1=mardi, 2=mercredi
}

function encodeEmail(email: string): string {
  return email.toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
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
  private adminListenersInitialized = false;
  private rotationChecked = false;

  state = signal<AppState>({
    persons: [],
    notifPrefs: { eve: false, morning: false, swap: false },
    rules: { auto: true, catch: true, manual: false },
    history: [],
    teamName: '',
    notifications: [],
    currentIndex: 0,
    sessionOffset: 0,
  });

  darkMode    = signal<boolean>(localStorage.getItem('darkMode') === 'true');
  syncStatus  = signal<'syncing' | 'online' | 'offline'>('syncing');
  activeTab   = signal<'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params' | 'admin'>('rotation');
  users       = signal<UserProfile[]>([]);
  showAddModal  = signal(false);
  showEditModal = signal(false);
  editPerson    = signal<Person | null>(null);
  personToDelete  = signal<Person | null>(null);
  personToPromote = signal<Person | null>(null);
  promoteBlocked  = signal(false);
  fcmStatus     = signal<'idle' | 'pending' | 'granted' | 'denied'>('idle');

  // Auth
  currentUser = signal<User | null>(null);
  isAdmin     = signal(false);
  authStatus  = signal<'loading' | 'authenticated' | 'unauthenticated' | 'blocked'>('loading');
  authError   = signal<string | null>(null);

  /** Nom d'affichage de l'utilisateur connecté (depuis la liste des membres si dispo, sinon email). */
  currentUserName = () => {
    const email = this.currentUser()?.email;
    if (!email) return 'Inconnu';
    return this.state().persons.find(p => p.email === email)?.name ?? email;
  };

  constructor() {
    this.app  = initializeApp(environment.firebase);
    this.db   = getFirestore(this.app);
    this.auth = getAuth(this.app);
    if (environment.useEmulators) {
      connectFirestoreEmulator(this.db, 'localhost', 8080);
      connectAuthEmulator(this.auth, 'http://localhost:9099', { disableWarnings: true });
    }
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

      // Vérifier blocage + lire le profil en parallèle
      const [deletionSnap, userSnap] = await Promise.all([
        user.email
          ? getDoc(doc(this.db, 'pendingDeletions', encodeEmail(user.email)))
          : Promise.resolve(null),
        getDoc(doc(this.db, 'users', user.uid)),
      ]);

      if (deletionSnap?.exists()) {
        await signOut(this.auth);
        this.authStatus.set('blocked');
        this.authError.set('Vos accès ont été supprimés. Veuillez contacter un administrateur.');
        return;
      }

      const userRef = doc(this.db, 'users', user.uid);
      let role = 'member';

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email, role: 'member', notifPrefs: { eve: true, morning: true, swap: true },
          createdAt: serverTimestamp(), lastLogin: serverTimestamp(), appVersion: APP_VERSION,
        });
      } else {
        role = userSnap.data()?.['role'] ?? 'member';
        await setDoc(userRef, { lastLogin: serverTimestamp(), appVersion: APP_VERSION }, { merge: true });
      }

      this.currentUser.set(user);
      this.isAdmin.set(role === 'admin');
      this.authStatus.set('authenticated');

      if (!this.listenersInitialized) {
        this.listenersInitialized = true;
        this.initFirestoreListeners(user.uid);
        this.autoInitFCM();
      }

      if (role === 'admin' && !this.adminListenersInitialized) {
        this.adminListenersInitialized = true;
        this.initAdminListeners();
      }

      // Création du membre en arrière-plan (nouveaux utilisateurs uniquement)
      this.addPersonFromEmail(user.email ?? '').catch(e =>
        console.error('[auth] addPersonFromEmail failed:', e)
      );
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
          teamName:      d['teamName']      ?? s.teamName,
          currentIndex:  d['currentIndex']  ?? s.currentIndex,
          rules:         d['rules']         ?? s.rules,
          sessionOffset: d['sessionOffset'] ?? 0,
        }));
      } else if (!snap.metadata.fromCache) {
        // N'initialiser le document que si le serveur confirme son absence,
        // pour éviter d'écraser lastRotationDate sur un snapshot cache vide.
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
        // Attendre un snapshot confirmé par le serveur avant de déclencher la
        // rotation : addPersonFromEmail() en amont peut amorcer le cache local
        // avec un seul document (résultat d'un where filtré), ce qui ferait
        // tourner checkAndRotate sur une liste partielle.
        if (!this.rotationChecked && persons.length > 0 && !snap.metadata.fromCache) {
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

  private initAdminListeners() {
    onSnapshot(collection(this.db, 'users'), (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      this.users.set(users);
    });
  }

  openTab(tab: 'rotation' | 'remplacement' | 'historique' | 'rappels' | 'params' | 'admin') {
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

  setSessionOffset(offset: number) {
    this.state.update(s => ({ ...s, sessionOffset: offset }));
    updateDoc(doc(this.db, 'teams', this.teamId), { sessionOffset: offset });
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
    const persons = this.state().persons;
    const idx = persons.findIndex(p => p.id === personId);
    const { absentDateLabel, catchupDateLabel } = computeAbsentDates(idx, this.state().sessionOffset);

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

  // Déplace le remplaçant juste devant l'absent, quel que soit son rang dans la liste.
  promoteReplacement(absentId: string, replacementId: string) {
    const persons = reorderForReplacement(this.state().persons, absentId, replacementId);
    if (!persons) return;

    this.state.update(s => ({ ...s, persons: persons.map((p, i) => ({ ...p, rank: i })) }));

    const batch = writeBatch(this.db);
    persons.forEach((p, i) => {
      const update: any = { rank: i };
      if (p.id === absentId) update.promoted = true;
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
    // getDocFromServer garantit de lire lastRotationDate depuis le serveur,
    // sans risque de lire un cache potentiellement antérieur à la dernière rotation.
    const teamSnap = await getDocFromServer(doc(this.db, 'teams', this.teamId));
    const lastRotationDate: string | null = teamSnap.data()?.['lastRotationDate'] ?? null;
    const sessionOffset: number = teamSnap.data()?.['sessionOffset'] ?? 0;

    const { thisEventDate, thisEventDateStr, todayStr } = computeEventDate(sessionOffset);
    if (!shouldRotate(todayStr, thisEventDateStr, lastRotationDate)) return;

    const { updated, carrierName } = rotateOnce(persons);

    const batch = writeBatch(this.db);
    updated.forEach((p, i) => {
      const update: any = { rank: i };
      // rotateOnce() ne convertit en rattrapage que le nouveau premier (rang 0) :
      // les autres absents gardent leur statut ⛔, ce n'est pas encore leur tour.
      if (i === 0 && p.status === 'catch') {
        update.status = 'catch';
        update.replacedBy = null;
      }
      batch.update(doc(this.db, 'teams', this.teamId, 'persons', p.id), update);
    });
    batch.update(doc(this.db, 'teams', this.teamId), { lastRotationDate: thisEventDateStr, sessionOffset: 0 });
    await batch.commit();

    // Enregistre le passage dans l'historique
    await addDoc(collection(this.db, 'teams', this.teamId, 'history'), {
      date: eventDateLabel(thisEventDate),
      type: 'Passage',
      details: { text: `${carrierName} a apporté les croissants` },
      timestamp: serverTimestamp(),
    });

    // Purge de l'historique : on ne conserve que les 6 derniers mois
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

    const { name, initials } = derivePersonFromEmail(email);

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
