// Spec 05-ui-redesign, Requirement 5: one easing curve, bounded stagger, number tweens end exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../public/motion-logic.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('the curve is monotonic, starts at 0 and ends at 1', () => {
  assert.equal(M.ease(0), 0);
  assert.equal(M.ease(1), 1);
  assert.equal(M.ease(-1), 0);
  assert.equal(M.ease(2), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i += 1) {
    const v = M.ease(i / 100);
    assert.ok(v >= prev - 1e-9, `monotonic at ${i}`);
    prev = v;
  }
  assert.ok(M.ease(0.5) > 0.5, 'ease-out shape: past halfway at half time');
});

test('cubicBezier matches the linear case and rejects bad control points', () => {
  const lin = M.cubicBezier(0, 0, 1, 1);
  for (const t of [0.1, 0.25, 0.5, 0.9]) assert.ok(Math.abs(lin(t) - t) < 1e-5, String(t));
  assert.throws(() => M.cubicBezier(-0.1, 0, 1, 1), RangeError);
  assert.throws(() => M.cubicBezier(0, 0, 1.2, 1), RangeError);
  assert.throws(() => M.cubicBezier(0, Number.NaN, 1, 1), RangeError);
});

test('stagger stops after six items', () => {
  assert.deepEqual([0, 1, 2, 5, 6, 40].map((i) => M.staggerDelay(i)), [0, 40, 80, 200, 200, 200]);
  assert.equal(M.staggerDelay(-3), 0);
});

test('durations stay inside the three allowed steps', () => {
  assert.deepEqual(Object.values(M.DURATION_MS), [120, 200, 320]);
  assert.ok(M.RISE_PX >= 6 && M.RISE_PX <= 12);
});

test('reduced motion turns motion off', () => {
  assert.equal(M.motionAllowed(true), false);
  assert.equal(M.motionAllowed(false), true);
});

test('number tweens keep decimals and end on the exact text', () => {
  assert.equal(M.tweenText('10000', 1), '10000');
  assert.equal(M.tweenText('0.6686', 1), '0.6686');
  assert.match(M.tweenText('0.6686', 0.5), /^0\.\d{4}$/);
  assert.equal(M.tweenText('n/a', 0.3), 'n/a');
  assert.equal(M.tweenText('12', 0), '0');
});

test('motion.js reads reduced motion before every tween and uses the shared curve', () => {
  const src = readFileSync(path.join(PUBLIC, 'motion.js'), 'utf8');
  assert.match(src, /from '\/vendor\/animejs-4\.5\.0\/anime\.esm\.min\.js'/);
  assert.match(src, /from '\/motion-logic\.js'/);
  for (const fn of ['entrance', 'settle', 'lightStep', 'countTo', 'flash']) {
    const body = src.slice(src.indexOf(`export function ${fn}`));
    const head = body.slice(0, body.indexOf('\n}'));
    assert.match(head, /allowed\(\)|gsapOrNull\(\)/, `${fn} checks reduced motion`);
  }
  assert.doesNotMatch(src, /repeat:\s*-1|loop:\s*true|yoyo/, 'no looping motion');
  assert.doesNotMatch(src, /innerHTML|https?:\/\//);
});
