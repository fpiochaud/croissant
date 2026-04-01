export const TEST_TEAM_ID = 'equipe-test';

export const TEST_ADMIN = {
  uid: 'admin-uid',
  email: 'admin@test.com',
  password: 'password123',
  role: 'admin' as const,
};

export const TEST_USERS = [
  TEST_ADMIN,
  {
    uid: 'alice-uid',
    email: 'alice@test.com',
    password: 'password123',
    role: 'member' as const,
  },
];

// Ordre initial : Alice → Bob → Charlie → Diana
export const TEST_PERSONS = [
  { id: 'alice', name: 'Alice', initials: 'AL', color: 'c1', status: 'ok' as const, rank: 0, email: 'alice@test.com' },
  { id: 'bob',   name: 'Bob',   initials: 'BO', color: 'c2', status: 'ok' as const, rank: 1, email: 'bob@test.com'   },
  { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok' as const, rank: 2, email: 'charlie@test.com' },
  { id: 'diana', name: 'Diana', initials: 'DI', color: 'c4', status: 'ok' as const, rank: 3, email: 'diana@test.com' },
];

/**
 * Retourne la date ISO du jour de croissants le plus récent passé.
 * Même logique que getMostRecentPastCroissantDay() dans le service.
 */
export function getMostRecentPastDay(offset: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDow = 1 + offset;
  const day = today.getDay();
  const daysBack = day === targetDow ? 7 : (day > targetDow ? day - targetDow : 7 - targetDow + day);
  const last = new Date(today);
  last.setDate(today.getDate() - daysBack);
  return last.toISOString().split('T')[0];
}

export interface TeamDocOverrides {
  lastRotationDate?: string;
  sessionOffset?: number;
}

/**
 * Retourne le libellé de date du prochain lundi (ou aujourd'hui si lundi)
 * au format utilisé par le composant rotation (fr-FR).
 * Correspond à rawDates[0] avec offset=0 dans personsWithDates.
 */
export function getSlot0Label(): string {
  return getSlotLabel(0);
}

/**
 * Retourne le libellé de date du slot n avec offset (prochain lundi + offset + n*7 jours)
 * au format utilisé par le composant rotation (fr-FR, avec jour de la semaine).
 */
export function getSlotLabel(n: number, offset = 0): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const daysUntilMonday = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday + offset + n * 7);
  return nextMonday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

/**
 * Retourne le libellé de date d'absence pour le slot n avec un offset donné,
 * au format utilisé par le service lors de l'enregistrement (fr-FR, sans jour de la semaine).
 * Correspond à getNextCroissantDay(offset) + n*7 jours.
 * Ex: getAbsentDateLabel(2, 1) = "mardi 21 avr." sans le jour de semaine → "21 avr."
 */
export function getAbsentDateLabel(slotIndex: number, offset = 0): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const daysUntilMonday = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
  const d = new Date(today);
  d.setDate(today.getDate() + daysUntilMonday + offset + slotIndex * 7);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Retourne le libellé du dernier lundi passé au format court fr-FR (ex: "30 mars").
 * Correspond à la date d'absence d'une personne qui était au rang 0 lors de la rotation précédente.
 */
export function getLastMondayLabel(): string {
  const lastMonday = getMostRecentPastDay(0);
  return new Date(lastMonday + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Retourne la date ISO du lundi précédant le dernier lundi passé.
 * Utiliser comme lastRotationDate pour déclencher une rotation lors du chargement.
 */
export function getPreviousRotationDate(): string {
  const lastMonday = getMostRecentPastDay(0);
  const d = new Date(lastMonday);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export function makeTeamDoc(overrides: TeamDocOverrides = {}) {
  return {
    teamName: 'Équipe Test',
    currentIndex: 0,
    rules: { auto: true, catch: true, manual: false },
    sessionOffset: 0,
    // Par défaut : la rotation de cette semaine a déjà eu lieu (offset=0)
    lastRotationDate: getMostRecentPastDay(0),
    ...overrides,
  };
}
