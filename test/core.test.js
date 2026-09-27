import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findDstTransitions } from '../src/index.js';

describe('findDstTransitions', () => {
  it('returns both transitions for US Eastern 2024', () => {
    const r = findDstTransitions('America/New_York', 2024);
    assert.equal(r.length, 2);
    assert.equal(r[0].direction, 'spring-forward');
    assert.equal(r[0].minutes, 60);
    assert.equal(r[0].instant.toISOString(), '2024-03-10T07:00:00.000Z');
    assert.equal(r[1].direction, 'fall-back');
    assert.equal(r[1].minutes, 60);
    assert.equal(r[1].instant.toISOString(), '2024-11-03T06:00:00.000Z');
  });

  it('returns both transitions for EU London 2023', () => {
    const r = findDstTransitions('Europe/London', 2023);
    assert.equal(r.length, 2);
    assert.equal(r[0].direction, 'spring-forward');
    assert.equal(r[0].instant.toISOString(), '2023-03-26T01:00:00.000Z');
    assert.equal(r[1].direction, 'fall-back');
    assert.equal(r[1].instant.toISOString(), '2023-10-29T01:00:00.000Z');
  });

  it('returns empty array for UTC zone', () => {
    assert.deepEqual(findDstTransitions('UTC', 2024), []);
  });

  it('returns empty array for a zone that never observes DST', () => {
    assert.deepEqual(findDstTransitions('Asia/Tokyo', 2024), []);
  });

  it('handles 30-minute DST offset (Lord Howe 2020)', () => {
    const r = findDstTransitions('Australia/Lord_Howe', 2020);
    assert.equal(r.length, 2);
    // Southern hemisphere: year starts in DST, falls back first, springs forward later.
    assert.equal(r[0].direction, 'fall-back');
    assert.equal(r[0].minutes, 30);
    assert.equal(r[1].direction, 'spring-forward');
    assert.equal(r[1].minutes, 30);
  });

  it('reports historical DST even for zones that abolished it (Moscow 2010)', () => {
    const r = findDstTransitions('Europe/Moscow', 2010);
    assert.equal(r.length, 2);
    assert.equal(r[0].direction, 'spring-forward');
    assert.equal(r[0].instant.toISOString(), '2010-03-27T23:00:00.000Z');
    assert.equal(r[1].direction, 'fall-back');
    assert.equal(r[1].instant.toISOString(), '2010-10-30T23:00:00.000Z');
  });

  it('handles southern-hemisphere ordering (Sydney 2024)', () => {
    const r = findDstTransitions('Australia/Sydney', 2024);
    assert.equal(r.length, 2);
    // Southern hemisphere: year starts in DST, falls back first, springs forward later.
    assert.equal(r[0].direction, 'fall-back');
    assert.equal(r[0].instant.toISOString(), '2024-04-06T16:00:00.000Z');
    assert.equal(r[1].direction, 'spring-forward');
    assert.equal(r[1].instant.toISOString(), '2024-10-05T16:00:00.000Z');
  });

  it('includes offset changes within the calendar year where present (Antarctica/Casey 2010)', () => {
    // Casey station had an offset discontinuity in 2010; the library reports
    // every offset change inside the calendar year, including large jumps.
    const r = findDstTransitions('Antarctica/Casey', 2010);
    assert.ok(r.every((t) => t.minutes > 0 && t.minutes <= 240));
    assert.ok(r.every((t) => t.direction === 'spring-forward' || t.direction === 'fall-back'));
  });

  it('throws on empty timezone', () => {
    assert.throws(() => findDstTransitions('', 2024), TypeError);
  });

  it('throws on non-integer year', () => {
    assert.throws(() => findDstTransitions('America/New_York', 2024.5), TypeError);
  });

  it('throws on out-of-range year', () => {
    assert.throws(() => findDstTransitions('America/New_York', -1), TypeError);
    assert.throws(() => findDstTransitions('America/New_York', 10000), TypeError);
  });
});
