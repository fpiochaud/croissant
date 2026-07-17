import { describe, it, expect } from 'vitest';
import {
  Person,
  getNextCroissantDay,
  computeEventDate,
  shouldRotate,
  rotateOnce,
  reorderForReplacement,
  computeAbsentDates,
  computePersonsWithDates,
  derivePersonFromEmail,
} from './rotation-logic';

function person(overrides: Partial<Person> & { id: string; name: string }): Person {
  return { initials: 'XX', color: 'c1', status: 'ok', ...overrides };
}

describe('shouldRotate / computeEventDate', () => {
  // Reprend offset-rotation.spec.ts (bug #1) : changer sessionOffset ne doit
  // pas décaler la référence utilisée pour une rotation déjà effectuée.
  it("ne déclenche pas de rotation si elle a déjà eu lieu pour l'événement de cette semaine, quel que soit l'offset", () => {
    const monday = new Date('2026-07-20T00:00:00'); // un lundi
    for (const sessionOffset of [0, 1, 2]) {
      const { thisEventDateStr, todayStr } = computeEventDate(sessionOffset, new Date('2026-07-23T00:00:00'));
      const eventDate = computeEventDate(sessionOffset, monday).thisEventDateStr;
      expect(shouldRotate(todayStr, thisEventDateStr, eventDate)).toBe(false);
    }
  });

  // Reprend offset-rotation.spec.ts (bug corrigé le 7 avril 2026) : la rotation
  // ne doit pas se déclencher le jour J de l'événement, même décalé par l'offset.
  it("ne déclenche pas de rotation le jour J de l'événement (avec ou sans offset)", () => {
    for (const sessionOffset of [0, 1, 2]) {
      const today = computeEventDate(sessionOffset, new Date('2026-07-20T00:00:00')).thisEventDate;
      const { thisEventDateStr, todayStr } = computeEventDate(sessionOffset, today);
      expect(shouldRotate(todayStr, thisEventDateStr, null)).toBe(false);
    }
  });

  it("déclenche la rotation le lendemain du jour J si aucune rotation n'a encore eu lieu", () => {
    const eventDay = new Date('2026-07-20T00:00:00');
    const dayAfter = new Date('2026-07-21T00:00:00');
    const { thisEventDateStr, todayStr } = computeEventDate(0, dayAfter);
    expect(thisEventDateStr).toBe(computeEventDate(0, eventDay).thisEventDateStr);
    expect(shouldRotate(todayStr, thisEventDateStr, null)).toBe(true);
  });
});

describe('rotateOnce', () => {
  // Reprend rotation-day.spec.ts (bug #4) : seul le nouveau premier (rang 0)
  // passe en rattrapage ; les autres absents gardent leur badge ⛔.
  it('ne convertit en rattrapage que le nouveau premier, pas les autres absents', () => {
    const persons = [
      person({ id: 'alice', name: 'Alice', status: 'ok' }),
      person({ id: 'bob', name: 'Bob', status: 'ok' }),
      person({ id: 'charlie', name: 'Charlie', status: 'absent', replacedBy: 'Bob' }),
      person({ id: 'diana', name: 'Diana', status: 'ok' }),
    ];

    const { updated } = rotateOnce(persons);

    expect(updated.map(p => p.id)).toEqual(['bob', 'charlie', 'diana', 'alice']);
    expect(updated.find(p => p.id === 'charlie')?.status).toBe('absent');
  });

  it('convertit le nouveau premier en rattrapage quand il était déjà marqué absent', () => {
    // Bob (rang 1) est déjà marqué absent avant que la rotation ne le fasse
    // passer en rang 0 : son tour arrive, il doit passer en rattrapage.
    const persons = [
      person({ id: 'alice', name: 'Alice', status: 'ok' }),
      person({ id: 'bob', name: 'Bob', status: 'absent', replacedBy: 'Charlie' }),
      person({ id: 'charlie', name: 'Charlie', status: 'ok' }),
    ];

    const { updated, carrierName } = rotateOnce(persons);

    expect(updated[0].id).toBe('bob');
    expect(updated[0].status).toBe('catch');
    expect(updated[0].replacedBy).toBeNull();
    expect(carrierName).toBe('Alice'); // Alice (rang 0) vient de faire le passage
  });

  it("attribue le passage à la personne elle-même si elle n'était pas absente", () => {
    const persons = [person({ id: 'alice', name: 'Alice' }), person({ id: 'bob', name: 'Bob' })];
    const { carrierName } = rotateOnce(persons);
    expect(carrierName).toBe('Alice');
  });
});

describe('reorderForReplacement', () => {
  // Reprend multi-absent.spec.ts (bug #2) : le remplaçant doit passer devant
  // l'absent même quand celui-ci n'est pas en tête de liste.
  it("fait passer le remplaçant devant l'absent quand l'absent n'est pas premier", () => {
    const persons = [
      person({ id: 'bob', name: 'Bob' }),
      person({ id: 'alice', name: 'Alice', status: 'absent' }),
      person({ id: 'charlie', name: 'Charlie', status: 'absent' }),
      person({ id: 'diana', name: 'Diana' }),
    ];

    const result = reorderForReplacement(persons, 'charlie', 'diana');

    expect(result).not.toBeNull();
    const ids = result!.map(p => p.id);
    expect(ids.indexOf('diana')).toBeLessThan(ids.indexOf('charlie'));
  });

  it('ne fait rien si le remplaçant est déjà devant l\'absent', () => {
    const persons = [person({ id: 'bob', name: 'Bob' }), person({ id: 'alice', name: 'Alice', status: 'absent' })];
    expect(reorderForReplacement(persons, 'alice', 'bob')).toBeNull();
  });

  it("ne fait rien si l'absent ou le remplaçant est introuvable", () => {
    const persons = [person({ id: 'alice', name: 'Alice' })];
    expect(reorderForReplacement(persons, 'inconnu', 'alice')).toBeNull();
  });
});

describe('computeAbsentDates', () => {
  // Reprend offset-display.spec.ts (bug #5) : l'offset ne doit s'appliquer
  // qu'au slot 0 — pas aux slots suivants.
  it("n'applique l'offset qu'au rang 0", () => {
    const today = new Date('2026-07-13T00:00:00'); // un lundi
    const withOffset = computeAbsentDates(2, 1, today);
    const withoutOffset = computeAbsentDates(2, 0, today);
    expect(withOffset.absentDateLabel).toBe(withoutOffset.absentDateLabel);
  });

  it('applique bien l\'offset au rang 0', () => {
    const today = new Date('2026-07-13T00:00:00');
    const withOffset = computeAbsentDates(0, 1, today);
    const withoutOffset = computeAbsentDates(0, 0, today);
    expect(withOffset.absentDateLabel).not.toBe(withoutOffset.absentDateLabel);
  });

  it('la date de rattrapage est une semaine après la date d\'absence', () => {
    const { absentDateLabel, catchupDateLabel } = computeAbsentDates(0, 0, new Date('2026-07-13T00:00:00'));
    expect(catchupDateLabel).not.toBe(absentDateLabel);
  });
});

describe('computePersonsWithDates', () => {
  // Reprend multi-absent.spec.ts (bug #3) : avec deux absents consécutifs
  // sans remplaçant, le suivant hérite du slot du PREMIER absent de la
  // cascade, pas de celui juste avant lui.
  it('cascade la date à travers plusieurs absents consécutifs sans remplaçant', () => {
    const today = new Date('2026-07-13T00:00:00'); // lundi
    const persons = [
      person({ id: 'a', name: 'A', status: 'absent' }),
      person({ id: 'b', name: 'B', status: 'absent' }),
      person({ id: 'c', name: 'C' }),
    ];

    // C doit hériter du slot du PREMIER absent de la cascade (A, index 0),
    // pas de celui juste avant lui (B, index 1) — c'était le bug #3.
    const slot0Label = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    const result = computePersonsWithDates(persons, 0, today);
    expect(result[2].dateLabel).toBe(slot0Label);
  });

  it('un absent déjà remplacé ne transmet pas son slot au suivant', () => {
    const today = new Date('2026-07-13T00:00:00');
    const persons = [
      person({ id: 'bob', name: 'Bob' }),
      person({ id: 'alice', name: 'Alice', status: 'absent', replacedBy: 'Bob' }),
      person({ id: 'charlie', name: 'Charlie' }),
    ];

    const result = computePersonsWithDates(persons, 0, today);
    expect(result[2].dateLabel).not.toBe(result[1].dateLabel);
  });
});

describe('derivePersonFromEmail', () => {
  // Reprend auto-member-creation.spec.ts : nom et initiales dérivés de l'email.
  it("dérive le nom et les initiales d'un email simple", () => {
    expect(derivePersonFromEmail('leoncamet@outlook.com')).toEqual({ name: 'Leoncamet', initials: 'LE' });
  });

  it("dérive le nom complet et les initiales d'un email avec séparateur", () => {
    expect(derivePersonFromEmail('jean.dupont@example.com')).toEqual({ name: 'Jean Dupont', initials: 'JD' });
  });
});

describe('getNextCroissantDay', () => {
  it('retourne le lundi de la semaine si on est déjà lundi', () => {
    const monday = new Date('2026-07-20T00:00:00');
    const next = getNextCroissantDay(0, monday);
    expect(next.getDay()).toBe(1);
    expect(next.toDateString()).toBe(monday.toDateString());
  });

  it('retourne le prochain lundi si on est en milieu de semaine', () => {
    const wednesday = new Date('2026-07-22T00:00:00');
    const next = getNextCroissantDay(0, wednesday);
    expect(next.getDay()).toBe(1);
    expect(next.getTime()).toBeGreaterThan(wednesday.getTime());
  });
});
