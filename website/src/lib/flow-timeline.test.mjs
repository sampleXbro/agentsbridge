import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  keyframes,
  LOOP_SECONDS,
  pct,
  showBetween,
  showWindows,
  timelineCss,
  typeBetween,
} from './flow-timeline.mjs';

test('pct: seconds map onto the loop, clamped to 0..100', () => {
  assert.equal(LOOP_SECONDS, 16);
  assert.equal(pct(0), 0);
  assert.equal(pct(4), 25);
  assert.equal(pct(8.5), 53.125);
  assert.equal(pct(16), 100);
  assert.equal(pct(17), 100);
  assert.equal(pct(-1), 0);
});

test('keyframes: named block with ascending percentage frames and per-frame easing', () => {
  const css = keyframes('am-x', [
    { at: 0, props: { opacity: '0' } },
    { at: 4, props: { opacity: '1' }, easing: 'steps(3, end)' },
    { at: 16, props: { opacity: '0' } },
  ]);
  assert.equal(
    css,
    '@keyframes am-x{0%{opacity:0}25%{opacity:1;animation-timing-function:steps(3, end)}100%{opacity:0}}',
  );
});

test('keyframes: refuses frames that go backwards in time', () => {
  assert.throws(
    () =>
      keyframes('am-x', [
        { at: 4, props: {} },
        { at: 2, props: {} },
      ]),
    /ascending/,
  );
});

test('showBetween: hidden, rises in, holds, fades out, hidden to the end of the loop', () => {
  const frames = showBetween(2, 6, { enterMs: 500, exitMs: 250 });
  assert.deepEqual(
    frames.map((f) => [f.at, f.props.opacity, f.props.transform]),
    [
      [0, '0', 'translateY(8px)'],
      [2, '0', 'translateY(8px)'],
      [2.5, '1', 'none'],
      [5.75, '1', 'none'],
      [6, '0', 'translateY(8px)'],
      [16, '0', 'translateY(8px)'],
    ],
  );
});

test('showBetween: a fade has no transform, a window starting at 0 has no duplicate frame, and one ending at the loop end stays visible', () => {
  const fade = showBetween(0, 16, { enter: 'fade' });
  assert.equal(fade[0].at, 0);
  assert.equal(fade[0].props.transform, undefined);
  assert.equal(fade.filter((f) => f.at === 0).length, 1);
  assert.equal(fade.at(-1).at, 16);
  assert.equal(fade.at(-1).props.opacity, '1');
});

test('typeBetween: types the command with one step per character, holds, then resets', () => {
  const frames = typeBetween(1, 5, 15, { typeMs: 1000 });
  assert.deepEqual(
    frames.map((f) => [f.at, f.props.width, f.props.opacity, f.easing]),
    [
      [0, '0', '0', undefined],
      [1, '0', '1', 'steps(15, end)'],
      [2, '15ch', '1', undefined],
      [4.7, '15ch', '1', undefined],
      [5, '0', '0', undefined],
      [16, '0', '0', undefined],
    ],
  );
});

test('timelineCss: one stylesheet from many named windows', () => {
  const css = timelineCss([
    { name: 'a', segments: showBetween(0, 16, { enter: 'fade' }) },
    { name: 'b', segments: typeBetween(1, 5, 3) },
  ]);
  assert.match(css, /^@keyframes a\{/);
  assert.match(css, /\n@keyframes b\{/);
});

test('showWindows: several on-stage windows in one keyframe list', () => {
  const frames = showWindows(
    [
      [1, 3],
      [5, 16],
    ],
    { enterMs: 300, exitMs: 200 },
  );
  assert.deepEqual(
    frames.map((f) => [f.at, f.props.opacity]),
    [
      [0, '0'],
      [1, '0'],
      [1.3, '1'],
      [2.8, '1'],
      [3, '0'],
      [5, '0'],
      [5.3, '1'],
      [16, '1'],
    ],
  );
});
