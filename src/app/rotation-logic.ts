// Logique pure de rotation/dates, sans dépendance à Firestore.
// Isolée ici pour être testable unitairement (voir rotation-logic.spec.ts).

export interface Person {
  id: string;
  name: string;
  initials: string;
  color: string;
  status: 'ok' | 'absent' | 'catch';
  rank?: number;
  orderBase?: number;
  email?: string;
  replacedBy?: string | null;
  absentDate?: string | null;
  catchupDate?: string | null;
}

export interface PersonWithDate extends Person {
  dateLabel: string;
}

// Retourne la date du prochain lundi (ou aujourd'hui si lundi) + offset jours.
export function getNextCroissantDay(offset: number = 0, today: Date = new Date()): Date {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const daysUntilMonday = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
  const next = new Date(base);
  next.setDate(base.getDate() + daysUntilMonday + offset);
  return next;
}

function frLongDateLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

function frShortDateLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Calcule la vraie date de l'événement de la semaine en cours : lundi + sessionOffset.
export function computeEventDate(sessionOffset: number, today: Date = new Date()): {
  thisEventDate: Date;
  thisEventDateStr: string;
  todayStr: string;
} {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const dayOfWeek = t.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(t);
  thisMonday.setDate(t.getDate() - daysSinceMonday);
  const thisEventDate = new Date(thisMonday);
  thisEventDate.setDate(thisMonday.getDate() + sessionOffset);
  return {
    thisEventDate,
    thisEventDateStr: thisEventDate.toISOString().split('T')[0],
    todayStr: t.toISOString().split('T')[0],
  };
}

// Décide si la rotation hebdomadaire doit se déclencher :
//  - pas encore, si l'événement de cette semaine n'a pas encore eu lieu (aujourd'hui <= jour J) ;
//  - pas non plus si une rotation a déjà été enregistrée pour cet événement.
export function shouldRotate(todayStr: string, thisEventDateStr: string, lastRotationDate: string | null): boolean {
  if (todayStr <= thisEventDateStr) return false;
  if (lastRotationDate && lastRotationDate >= thisEventDateStr) return false;
  return true;
}

// Résout l'id de la personne qui a effectivement porté les croissants : le
// remplaçant si l'absent en a un (recherché par nom, replacedBy n'étant
// stocké que comme chaîne de nom — pas d'id), sinon la personne elle-même.
// Miroir exact de la résolution de carrierName ci-dessous, pour rester
// cohérent entre le texte d'historique et le décompte de cycle.
function resolveCarrierId(first: Person, persons: Person[]): string {
  if (first.status === 'absent' && first.replacedBy) {
    const replacement = persons.find(p => p.name === first.replacedBy);
    if (replacement) return replacement.id;
  }
  return first.id;
}

// Déplace le premier de la liste en dernier. Seul le nouveau premier passe en
// rattrapage s'il était absent — les autres absents gardent leur statut ⛔,
// ce n'est pas encore leur tour.
//
// `passedSinceSync` accumule les ids des personnes qui ont effectivement
// porté les croissants (remplaçant compté, pas l'absent remplacé) depuis la
// dernière resynchronisation, sans doublon. La resynchronisation (réordonner
// selon orderBase) ne se déclenche que lorsque TOUS les membres actuels sont
// passés au moins une fois — pas après un nombre fixe de rotations, un
// remplacement pouvant faire porter deux fois la même personne pendant
// qu'une autre n'a pas encore eu son tour. Les ids qui ne correspondent plus
// à un membre existant (suppression en cours de cycle) sont filtrés à chaque
// appel, pour ne jamais bloquer ni fausser le décompte.
//
// Garde absente : si la personne de référence orderBase 0 est absente au
// moment où le cycle se complète, la resynchronisation est reportée d'une
// rotation (le compteur n'est PAS remis à zéro) plutôt que de la placer en
// tête alors qu'elle n'est pas là ; elle est retentée à chaque rotation
// suivante jusqu'à ce que cette personne ne soit plus absente.
export function rotateOnce(
  persons: Person[],
  passedSinceSync: string[] = []
): { updated: Person[]; carrierName: string; passedSinceSync: string[] } {
  let updated = [...persons];
  const [first] = updated.splice(0, 1);
  updated.push(first);

  const newFirst = updated[0];
  if (newFirst?.status === 'absent') {
    updated[0] = { ...newFirst, status: 'catch', replacedBy: null };
  }

  const carrierName = first.status === 'absent' ? (first.replacedBy ?? first.name) : first.name;
  const carrierId = resolveCarrierId(first, persons);

  const validIds = new Set(persons.map(p => p.id));
  const withCarrier = passedSinceSync.includes(carrierId) ? passedSinceSync : [...passedSinceSync, carrierId];
  const filteredPassed = withCarrier.filter(id => validIds.has(id));

  const cycleComplete = persons.length > 0 && filteredPassed.length >= persons.length;

  let nextPassed = filteredPassed;
  if (cycleComplete) {
    const referenceFirst = persons.find(p => p.orderBase === 0);
    if (referenceFirst && referenceFirst.status !== 'absent') {
      updated = [...updated].sort((a, b) => (a.orderBase ?? 0) - (b.orderBase ?? 0));
      nextPassed = [];
    }
    // sinon : report — le cycle reste "complet", on retente au prochain appel
  }

  return { updated, carrierName, passedSinceSync: nextPassed };
}

export function eventDateLabel(thisEventDate: Date): string {
  return frLongDateLabel(thisEventDate);
}

// Suggère automatiquement un remplaçant pour un absent, en balayant la liste
// à partir de sa position (ordre de rotation, avec retour au début). Deux
// passes : d'abord un candidat qui n'a pas encore porté les croissants ce
// cycle (passedSinceSync) — pour garantir qu'un tour = chaque membre passe
// une seule fois, même en tenant compte des remplacements — puis, si tous
// les disponibles ont déjà porté (ex. presque tout le monde absent), le
// premier disponible peu importe s'il a déjà porté.
export function suggestReplacement(persons: Person[], absentId: string, passedSinceSync: string[] = []): Person | undefined {
  const idx = persons.findIndex(p => p.id === absentId);
  if (idx === -1 || persons.length <= 1) return undefined;

  const passedIds = new Set(passedSinceSync);
  const findCandidate = (skipAlreadyPassed: boolean): Person | undefined => {
    let nextIdx = (idx + 1) % persons.length;
    for (let tries = 0; tries < persons.length; tries++) {
      const candidate = persons[nextIdx];
      const eligible = candidate.id !== absentId
        && candidate.status !== 'absent'
        && (!skipAlreadyPassed || !passedIds.has(candidate.id));
      if (eligible) return candidate;
      nextIdx = (nextIdx + 1) % persons.length;
    }
    return undefined;
  };

  return findCandidate(true) ?? findCandidate(false);
}

// Déplace le remplaçant juste devant l'absent, quel que soit son rang dans la
// liste. Retourne null si le remplaçant est déjà devant (rien à faire).
export function reorderForReplacement(persons: Person[], absentId: string, replacementId: string): Person[] | null {
  const result = [...persons];
  const absentIdx = result.findIndex(p => p.id === absentId);
  const replacementIdx = result.findIndex(p => p.id === replacementId);

  if (absentIdx === -1 || replacementIdx === -1) return null;
  if (replacementIdx <= absentIdx) return null;

  const [replacement] = result.splice(replacementIdx, 1);
  result.splice(absentIdx, 0, replacement);
  return result;
}

// Calcule la date d'absence et la date de rattrapage d'une personne selon son
// rang courant. L'offset ne s'applique qu'au slot 0 (décalage ponctuel de la
// semaine en cours) — les slots suivants restent sur le lundi de base.
export function computeAbsentDates(personIndex: number, sessionOffset: number, today: Date = new Date()): {
  absentDateLabel: string;
  catchupDateLabel: string;
} {
  const absentDate = getNextCroissantDay(0, today);
  absentDate.setDate(absentDate.getDate() + personIndex * 7 + (personIndex === 0 ? sessionOffset : 0));
  const absentDateLabel = frShortDateLabel(absentDate);

  const catchupDateObj = new Date(absentDate);
  catchupDateObj.setDate(catchupDateObj.getDate() + 7);
  const catchupDateLabel = frShortDateLabel(catchupDateObj);

  return { absentDateLabel, catchupDateLabel };
}

// Calcule la date prévisionnelle de chaque personne pour l'affichage.
// Cascade récursive : remonter tous les absents consécutifs (sans remplaçant)
// pour trouver le premier slot disponible. Exemple : [A(absent), B(absent), C]
// → C hérite du slot de A, pas du slot de B.
export function computePersonsWithDates(persons: Person[], sessionOffset: number, today: Date = new Date()): PersonWithDate[] {
  const nextMonday = getNextCroissantDay(0, today);
  const rawDates = persons.map((_, i) => {
    const d = new Date(nextMonday);
    d.setDate(d.getDate() + i * 7 + (i === 0 ? sessionOffset : 0));
    return d;
  });

  return persons.map((person, index) => {
    let slot = index;
    while (slot > 0 && persons[slot - 1].status === 'absent' && !persons[slot - 1].replacedBy) {
      slot--;
    }
    return { ...person, dateLabel: frLongDateLabel(rawDates[slot]) };
  });
}

// Dérive le nom et les initiales d'une personne depuis son adresse email
// (utilisé pour la création automatique de membre à la première connexion).
export function derivePersonFromEmail(email: string): { name: string; initials: string } {
  const prefix = email.split('@')[0];
  const parts = prefix.split(/[._-]/).filter(Boolean);
  const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : prefix.slice(0, 2).toUpperCase();
  return { name, initials };
}
