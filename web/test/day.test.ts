import { test } from 'vitest';
import assert from 'node:assert/strict';
import { fromDateInput, occursInPeriod, toDateInput, toDateTimeInput } from '../src/support/day.ts';
import { commissionFromInput, millimesFromInput } from '../src/support/money.ts';
import { toPath, toStrokes } from '../src/support/signature.ts';

test('date inputs round-trip, even while a year is half typed', () => {
  for (const value of [ '0002-03-15', '0020-03-15', '0201-03-15', '2015-03-15' ]) {
    assert.equal(toDateInput(fromDateInput(value)), value);
  }
  assert.equal(toDateTimeInput(fromDateInput('2026-09-27T10:30')), '2026-09-27T10:30');
  assert.equal(fromDateInput(''), null);
});

test('periods overlap strictly: back-to-back rentals are allowed', () => {
  assert.equal(occursInPeriod([ 0, 10 ], [ 10, 20 ]), false);
  assert.equal(occursInPeriod([ 5, 15 ], [ 0, 20 ]), true);
  assert.equal(occursInPeriod([ 0, 30 ], [ 10, 20 ]), true);
  assert.equal(occursInPeriod([ 0, 10 ], [ 0, 10 ]), true);
});

test('prices typed in dinars become millimes', () => {
  assert.equal(millimesFromInput('87,5'), 87500);
  assert.equal(millimesFromInput('90'), 90000);
  assert.equal(millimesFromInput('0'), null);
  assert.equal(millimesFromInput('abc'), null);
});

test('a commission is typed in dinars or as a share of the total', () => {
  assert.equal(commissionFromInput('', 300000), 0);
  assert.equal(commissionFromInput('20', 300000), 20000);
  assert.equal(commissionFromInput('10%', 300000), 30000);
  assert.equal(commissionFromInput('12,5 %', 300000), 37500);
  assert.equal(commissionFromInput('150%', 300000), null);
  assert.equal(commissionFromInput('x', 300000), null);
});

test('a signature goes to an SVG path and back', () => {
  const strokes: [number, number][][] = [ [ [ 10.4, 20 ], [ 30, 40.6 ] ], [ [ 5, 5 ] ], [ [ 100, 150 ], [ 120, 160 ], [ 140, 150 ] ] ];
  const path = toPath(strokes);
  assert.equal(path, 'M10 20 L30 41 M100 150 L120 160 L140 150'); // a dot alone isn't a stroke
  assert.deepEqual(toStrokes(path), [ [ [ 10, 20 ], [ 30, 41 ] ], [ [ 100, 150 ], [ 120, 160 ], [ 140, 150 ] ] ]);
  assert.deepEqual(toStrokes(null), []);
});
