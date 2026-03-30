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
