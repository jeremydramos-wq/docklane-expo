import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextCollection, normaliseJobs } from '../src/jobs.ts';

const now = Date.parse('2026-11-24T09:30:00Z');
const confirmed = {
  id: 'test-current', pickup_area: 'West', delivery_area: 'East', pickup_address: null,
  pickup_from: '2026-11-24T09:00:00Z', pickup_until: '2026-11-24T10:00:00Z',
  deliver_by: '2026-11-24T16:00:00Z', acceptance_state: 'accepted', acknowledged_at: '2026-11-23T12:00:00Z',
};

test('next collection prioritises the current window and then the earliest confirmed pickup', () => {
  const later = { ...confirmed, id: 'test-later', pickup_from: '2026-11-24T11:00:00Z', pickup_until: '2026-11-24T12:00:00Z', acceptance_state: 'accepted_on_behalf' };
  const jobs = [later, { ...confirmed, id: 'test-ended', pickup_until: new Date(now).toISOString() }, confirmed];
  assert.equal(nextCollection(jobs, now)?.id, 'test-current');
  assert.equal(nextCollection(jobs, Date.parse(confirmed.pickup_until))?.id, 'test-later');
  assert.equal(nextCollection(jobs, Date.parse(later.pickup_until)), undefined);
});

test('withdrawn, expired and pending assignments cannot supply a next pickup or map action', () => {
  const jobs = ['released', 'expired', 'timed_out', 'awaiting_driver', 'awaiting_acceptance'].map(acceptance_state => ({...confirmed, acceptance_state}));
  assert.equal(nextCollection(jobs, now), undefined);
  assert.equal(nextCollection([], now), undefined);
});

test('legacy and on-behalf confirmations retain the authorised address projection', () => {
  const [legacy] = normaliseJobs([confirmed], true).items;
  assert.equal(nextCollection([legacy], now)?.pickup_address, null);
  const onBehalf = { ...legacy, id: 'test-behalf', acceptance_state: 'accepted_on_behalf', pickup_address: 'Synthetic depot' };
  assert.equal(nextCollection([onBehalf], now)?.pickup_address, 'Synthetic depot');
});

test('simultaneous pickups are stable across refresh order and equivalent ISO offsets', () => {
  const a = { ...confirmed, id: 'a', pickup_from: '2026-11-24T10:00:00+01:00' };
  const z = { ...confirmed, id: 'z' };
  assert.equal(nextCollection([a,z], now)?.id, 'a');
  assert.equal(nextCollection([z,a], now)?.id, 'a');
});
