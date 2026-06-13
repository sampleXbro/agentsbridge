import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { colorEnabled } from '../../../src/utils/output/color.js';

const TTY = { isTTY: true };
const PIPE = { isTTY: false };

describe('colorEnabled', () => {
  let prevNoColor: string | undefined;
  let prevForceColor: string | undefined;

  beforeEach(() => {
    prevNoColor = process.env.NO_COLOR;
    prevForceColor = process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    if (prevNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prevNoColor;
    if (prevForceColor === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = prevForceColor;
  });

  it('disables color when the stream is not a TTY', () => {
    expect(colorEnabled(PIPE)).toBe(false);
  });

  it('enables color when the stream is a TTY', () => {
    expect(colorEnabled(TTY)).toBe(true);
  });

  it('treats a stream without isTTY as non-TTY', () => {
    expect(colorEnabled({})).toBe(false);
  });

  it('disables color when NO_COLOR is set, even on a TTY', () => {
    process.env.NO_COLOR = '1';
    expect(colorEnabled(TTY)).toBe(false);
  });

  it('ignores an empty NO_COLOR (not a disable signal) on a TTY', () => {
    process.env.NO_COLOR = '';
    expect(colorEnabled(TTY)).toBe(true);
  });

  it('still suppresses color on a non-TTY when NO_COLOR is empty', () => {
    process.env.NO_COLOR = '';
    expect(colorEnabled(PIPE)).toBe(false);
  });

  it('forces color on a non-TTY when FORCE_COLOR is set', () => {
    process.env.FORCE_COLOR = '1';
    expect(colorEnabled(PIPE)).toBe(true);
  });

  it('forces color off on a TTY when FORCE_COLOR is "0"', () => {
    process.env.FORCE_COLOR = '0';
    expect(colorEnabled(TTY)).toBe(false);
  });

  it('forces color off on a TTY when FORCE_COLOR is "false"', () => {
    process.env.FORCE_COLOR = 'false';
    expect(colorEnabled(TTY)).toBe(false);
  });

  it('lets FORCE_COLOR override NO_COLOR', () => {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '1';
    expect(colorEnabled(PIPE)).toBe(true);
  });

  it('defaults to process.stdout, honoring FORCE_COLOR', () => {
    process.env.FORCE_COLOR = '1';
    expect(colorEnabled()).toBe(true);
  });
});
