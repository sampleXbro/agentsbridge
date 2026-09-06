/**
 * A looping CSS timeline for the hero product story. Every element animates
 * over the same loop; its own keyframes say when it is on stage. Windows are
 * authored in seconds here and emitted as percentages, so the sequencing lives
 * in one place instead of scattered delays.
 */

/** @typedef {{ at: number, props: Record<string, string>, easing?: string }} Frame */

export const LOOP_SECONDS = 16;

const HIDDEN_RISE = { opacity: '0', transform: 'translateY(8px)' };
const SHOWN_RISE = { opacity: '1', transform: 'none' };
const HIDDEN_FADE = { opacity: '0' };
const SHOWN_FADE = { opacity: '1' };

/**
 * @param {number} seconds
 * @param {number} [loop]
 * @returns {number} percentage of the loop, clamped to 0..100
 */
export function pct(seconds, loop = LOOP_SECONDS) {
  const raw = (Math.min(Math.max(seconds, 0), loop) / loop) * 100;
  return Number(raw.toFixed(3));
}

/**
 * @param {string} name
 * @param {readonly Frame[]} frames
 * @param {number} [loop]
 * @returns {string}
 */
export function keyframes(name, frames, loop = LOOP_SECONDS) {
  let last = -1;
  const body = frames
    .map((f) => {
      if (f.at < last) throw new Error(`keyframes ${name}: frames must be ascending`);
      last = f.at;
      const decls = Object.entries(f.props).map(([k, v]) => `${k}:${v}`);
      if (f.easing !== undefined) decls.push(`animation-timing-function:${f.easing}`);
      return `${pct(f.at, loop)}%{${decls.join(';')}}`;
    })
    .join('');
  return `@keyframes ${name}{${body}}`;
}

/**
 * On stage from `from` to `to` seconds; off stage otherwise.
 * @param {number} from
 * @param {number} to
 * @param {{ enter?: 'rise' | 'fade', enterMs?: number, exitMs?: number, loop?: number }} [opts]
 * @returns {Frame[]}
 */
export function showBetween(from, to, opts = {}) {
  const { enter = 'rise', enterMs = 400, exitMs = 300, loop = LOOP_SECONDS } = opts;
  const hidden = enter === 'rise' ? HIDDEN_RISE : HIDDEN_FADE;
  const shown = enter === 'rise' ? SHOWN_RISE : SHOWN_FADE;
  /** @type {Frame[]} */
  const frames = [];
  if (from > 0) frames.push({ at: 0, props: hidden });
  frames.push({ at: from, props: hidden });
  frames.push({ at: from + enterMs / 1000, props: shown });
  if (to >= loop) {
    frames.push({ at: loop, props: shown });
    return frames;
  }
  frames.push({ at: to - exitMs / 1000, props: shown });
  frames.push({ at: to, props: hidden });
  frames.push({ at: loop, props: hidden });
  return frames;
}

/**
 * On stage during each `[from, to]` window, off stage between them: a badge
 * that disappears while its card drifts and returns once it is repaired.
 * @param {readonly (readonly [number, number])[]} windows ascending, non-overlapping
 * @param {{ enter?: 'rise' | 'fade', enterMs?: number, exitMs?: number, loop?: number }} [opts]
 * @returns {Frame[]}
 */
export function showWindows(windows, opts = {}) {
  const { enter = 'fade', enterMs = 300, exitMs = 200, loop = LOOP_SECONDS } = opts;
  const hidden = enter === 'rise' ? HIDDEN_RISE : HIDDEN_FADE;
  const shown = enter === 'rise' ? SHOWN_RISE : SHOWN_FADE;
  /** @type {Frame[]} */
  const frames = [{ at: 0, props: hidden }];
  let lastTo = 0;
  for (const [from, to] of windows) {
    if (from > 0) frames.push({ at: from, props: hidden });
    frames.push({ at: from + enterMs / 1000, props: shown });
    if (to >= loop) {
      frames.push({ at: loop, props: shown });
      return frames;
    }
    frames.push({ at: to - exitMs / 1000, props: shown });
    frames.push({ at: to, props: hidden });
    lastTo = to;
  }
  if (lastTo < loop) frames.push({ at: loop, props: hidden });
  return frames;
}

/**
 * A command that types itself: width grows one step per character (in `ch`, so
 * a mono font reveals exactly one glyph per step), holds, then resets. Pair with
 * `overflow:hidden; white-space:nowrap`.
 * @param {number} from
 * @param {number} to
 * @param {number} chars
 * @param {{ typeMs?: number, exitMs?: number, loop?: number }} [opts]
 * @returns {Frame[]}
 */
export function typeBetween(from, to, chars, opts = {}) {
  const { typeMs = 1000, exitMs = 300, loop = LOOP_SECONDS } = opts;
  return [
    { at: 0, props: { width: '0', opacity: '0' } },
    { at: from, props: { width: '0', opacity: '1' }, easing: `steps(${chars}, end)` },
    { at: from + typeMs / 1000, props: { width: `${chars}ch`, opacity: '1' } },
    { at: to - exitMs / 1000, props: { width: `${chars}ch`, opacity: '1' } },
    { at: to, props: { width: '0', opacity: '0' } },
    { at: loop, props: { width: '0', opacity: '0' } },
  ];
}

/**
 * @param {readonly { name: string, segments: readonly Frame[] }[]} entries
 * @param {number} [loop]
 * @returns {string}
 */
export function timelineCss(entries, loop = LOOP_SECONDS) {
  return entries.map((e) => keyframes(e.name, e.segments, loop)).join('\n');
}
