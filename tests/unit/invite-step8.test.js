import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildInviteShareMessage, buildInviteUrl } from '../../src/lib/inviteLinks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inviteSheet = readFileSync(join(root, 'src/components/InviteSheet.js'), 'utf8');

describe('Step 8 invite share UI', () => {
  it('exposes only WhatsApp and Copy Link actions', () => {
    assert.match(inviteSheet, /Share invite via WhatsApp/);
    assert.match(inviteSheet, /Copy invite link/);
    assert.match(inviteSheet, /<Text style=\{styles\.shareText\}>WhatsApp<\/Text>/);
    assert.match(inviteSheet, /<Text style=\{styles\.shareText\}>Copy Link<\/Text>/);
    assert.doesNotMatch(inviteSheet, /Share invite via Email/);
    assert.doesNotMatch(inviteSheet, /handleShareEmail/);
    assert.doesNotMatch(inviteSheet, /handleShareNative/);
    assert.doesNotMatch(inviteSheet, /Share\.share/);
    assert.doesNotMatch(inviteSheet, /nativeShareButton/);
    assert.doesNotMatch(inviteSheet, /<Text[^>]*>Share<\/Text>/);
    assert.doesNotMatch(inviteSheet, /<Text[^>]*>Email<\/Text>/);
  });

  it('uses the canonical invite URL for WhatsApp and Copy Link', () => {
    assert.match(inviteSheet, /buildInviteShareMessage/);
    assert.match(inviteSheet, /buildInviteUrl/);
    assert.match(inviteSheet, /whatsapp:\/\/send\?text=\$\{encodeURIComponent\(sharePayload\)\}/);
    assert.match(inviteSheet, /Clipboard\.setStringAsync\(inviteUrl\)/);
    assert.match(inviteSheet, /const inviteUrl = inviteCode \? buildInviteUrl\(inviteCode\) : ''/);
  });

  it('shows subtle confirmation after copying the invite link', () => {
    assert.match(inviteSheet, /Invite link copied/);
    assert.match(inviteSheet, /Toast\.show/);
    assert.match(inviteSheet, /position: 'bottom'/);
  });
});

describe('Step 8 invite integrity', () => {
  it('keeps WhatsApp message and copied URL aligned on the same canonical link', () => {
    const code = 'PAW-TEST8';
    const url = buildInviteUrl(code);
    const message = buildInviteShareMessage({ code });
    assert.ok(message.includes(url));
    assert.equal(url, buildInviteUrl(code));
  });
});
