import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMeetupCardHostedByLine,
  formatMeetupHostedByLine,
} from '../../src/utils/meetupHostDisplay.js';

describe('meetupHostDisplay', () => {
  it('formats card hosted-by line for one or two hosts', () => {
    assert.equal(
      formatMeetupCardHostedByLine({
        meetup_hosts: [{ pets: { name: 'Tyson' } }],
      }),
      'Hosted by Tyson',
    );
    assert.equal(
      formatMeetupCardHostedByLine({
        meetup_hosts: [{ pets: { name: 'Tyson' } }, { pets: { name: 'Bella' } }],
      }),
      'Hosted by Tyson • Bella',
    );
  });

  it('formats card hosted-by line as primary host + overflow count', () => {
    assert.equal(
      formatMeetupCardHostedByLine({
        meetup_hosts: [
          { pets: { name: 'Tyson' } },
          { pets: { name: 'Bella' } },
          { pets: { name: 'Peter' } },
        ],
      }),
      'Hosted by Tyson + 2',
    );
  });

  it('keeps detail hosted-by line listing all host names', () => {
    assert.equal(
      formatMeetupHostedByLine({
        meetup_hosts: [
          { pets: { name: 'Tyson' } },
          { pets: { name: 'Bella' } },
          { pets: { name: 'Peter' } },
        ],
      }),
      'Hosted by Tyson, Bella & Peter',
    );
  });
});
