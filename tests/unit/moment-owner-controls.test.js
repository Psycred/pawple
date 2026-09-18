import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSrc = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

describe('Moment owner controls', () => {
  it('shows edit and delete for own moments while keeping report for others', () => {
    const card = readSrc('src/components/MomentCard.js');
    const menu = readSrc('src/components/ContentSafetyMenu.js');

    assert.match(card, /canShowOwnerMenu/);
    assert.match(card, /showEdit=\{canShowOwnerMenu\}/);
    assert.match(card, /showDelete=\{canShowOwnerMenu\}/);
    assert.match(card, /showReport=\{canShowSafety\}/);
    assert.match(card, /deleteMoment/);
    assert.match(card, /editMomentId: moment\.id/);
    assert.doesNotMatch(card, /onMore=\{canShowSafety \? openMenu : undefined\}/);

    assert.match(menu, /showEdit/);
    assert.match(menu, /showDelete/);
    assert.match(menu, /onEdit/);
    assert.match(menu, /onDelete/);
  });

  it('passes viewer id and delete handler in feed and journal', () => {
    const feed = readSrc('src/screens/FeedScreen.js');
    const profile = readSrc('src/screens/PetProfileScreen.js');

    assert.match(feed, /viewerUserId=\{currentUserId\}/);
    assert.match(feed, /onMomentDeleted=\{handleMomentDeleted\}/);
    assert.match(profile, /viewerUserId=\{user\?\.id/);
    assert.match(profile, /onMomentDeleted=\{handleMomentDeleted\}/);
  });

  it('exports update and delete moment service helpers', () => {
    const service = readSrc('src/services/moments.js');

    assert.match(service, /export async function updateMoment/);
    assert.match(service, /export async function deleteMoment/);
  });
});
