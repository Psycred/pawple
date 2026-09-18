/**
 * Account notification inbox smoke.
 * Requires the Step 2 migration on a non-production integration project.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getIntegrationEnv, skipReason } from './helpers/env.js';
import { forceDeleteUser, provisionTestUser } from './helpers/fixtures.js';

const env = getIntegrationEnv();
const skip = skipReason(env);

test('Notifications: recipient-only RLS and individual read state', { skip }, async () => {
  const recipient = await provisionTestUser({ emailPrefix: 'notification-recipient' });
  const other = await provisionTestUser({ emailPrefix: 'notification-other' });

  try {
    const eventKey = `integration:${Date.now()}:${recipient.userId}`;
    const { data: inserted, error: insertError } = await recipient.admin
      .from('notifications')
      .insert({
        user_id: recipient.userId,
        from_user_id: other.userId,
        type: 'app_announcement',
        event_key: eventKey,
        title: 'Pawple has something new',
        body: 'A quiet integration test.',
      })
      .select('id')
      .single();
    assert.ifError(insertError);

    const { data: ownRows, error: ownError } = await recipient.client
      .from('notifications')
      .select('id, is_read, read_at')
      .eq('id', inserted.id);
    assert.ifError(ownError);
    assert.equal(ownRows.length, 1);
    assert.equal(ownRows[0].is_read, false);

    const { data: foreignRows, error: foreignError } = await other.client
      .from('notifications')
      .select('id')
      .eq('id', inserted.id);
    assert.ifError(foreignError);
    assert.equal(foreignRows.length, 0);

    const readAt = new Date().toISOString();
    const { data: marked, error: markError } = await recipient.client
      .from('notifications')
      .update({ is_read: true, read_at: readAt })
      .eq('id', inserted.id)
      .select('id, is_read, read_at')
      .single();
    assert.ifError(markError);
    assert.equal(marked.is_read, true);
    assert.ok(marked.read_at);

    const { error: insertDenied } = await recipient.client
      .from('notifications')
      .insert({
        user_id: recipient.userId,
        type: 'app_announcement',
        event_key: `${eventKey}:client`,
      });
    assert.ok(insertDenied, 'authenticated clients must not create inbox rows');
  } finally {
    await forceDeleteUser(recipient.admin, recipient.userId);
    await forceDeleteUser(other.admin, other.userId);
  }
});
