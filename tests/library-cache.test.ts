import { describe, expect, it } from 'vitest';
import { ownedIdsChanged } from '../lib/library-cache';

describe('ownedIdsChanged', () => {
  const epic = { offers: ['a', 'b'], newestOrderId: 'o2', fullSyncAt: 1, fetchedAt: 1 };

  it('ignores a refresh that found nothing new', () => {
    expect(ownedIdsChanged(epic, { ...epic, fetchedAt: 2, fullSyncAt: 2, newestOrderId: 'o3' })).toBe(false);
  });

  it('ignores Epic signing out while its library is kept', () => {
    expect(ownedIdsChanged(epic, { ...epic, signedOut: true })).toBe(false);
  });

  it('notices a purchase, a first load and a sign-out that clears it', () => {
    expect(ownedIdsChanged(epic, { ...epic, offers: ['a', 'b', 'c'] })).toBe(true);
    expect(ownedIdsChanged(undefined, epic)).toBe(true);
    expect(ownedIdsChanged({ apps: [1], packages: [], fetchedAt: 1 }, undefined)).toBe(true);
  });
});
