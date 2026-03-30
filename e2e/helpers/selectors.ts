import type { Page } from '@playwright/test';

/**
 * Retourne la carte d'une personne dans la liste de rotation en filtrant
 * sur le `.person-name` exact. Évite les faux positifs quand un nom
 * apparaît dans la méta d'une autre carte ("remplacé par X").
 */
export function personCard(page: Page, name: string) {
  return page
    .locator('#rotation-list .person-card')
    .filter({ has: page.locator('.person-name', { hasText: new RegExp(`^${name}$`) }) });
}
