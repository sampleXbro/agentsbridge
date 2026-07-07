import { describe, expect, it } from 'vitest';
import { contextKey, normalizeCommand } from '../../../src/lessons/context-key.js';

describe('normalizeCommand — reduce a command to its stable class', () => {
  it('keeps program + subcommand, drops flags and quoted args', () => {
    expect(normalizeCommand("git commit -m 'wip'")).toBe('git commit');
    expect(normalizeCommand('npm run test --watch')).toBe('npm run');
  });
  it('drops path-like tokens', () => {
    expect(normalizeCommand('tsc --noEmit src/x.ts')).toBe('tsc');
    expect(normalizeCommand('node ./scripts/build.mjs')).toBe('node');
  });
  it('falls back to the first token when nothing bare remains', () => {
    expect(normalizeCommand('./run.sh --all')).toBe('./run.sh');
  });
  it('strips leading env assignments so env-var variants share one class', () => {
    expect(normalizeCommand('FOO=bar npm test')).toBe('npm test');
    expect(normalizeCommand('A=1 B=2 npm run build')).toBe(normalizeCommand('npm run build'));
  });
});

describe('contextKey — bind an outcome to the concrete action', () => {
  const root = '/proj';
  it('prefers the file (the tighter signal), normalized project-relative', () => {
    expect(contextKey({ file: 'src/db.ts', command: 'git commit' }, root)).toBe('file:src/db.ts');
    expect(contextKey({ file: '/proj/src/db.ts' }, root)).toBe('file:src/db.ts');
  });
  it('falls back to the command class when no file', () => {
    expect(contextKey({ command: "git commit -m 'x'" }, root)).toBe('cmd:git commit');
  });
  it('is "none" when neither file nor command is present', () => {
    expect(contextKey({}, root)).toBe('none');
  });
  it('a delivery and a later failure on the SAME action produce the SAME key', () => {
    const atRecall = contextKey({ file: 'src/db.ts' }, root); // no error yet
    const atFailure = contextKey({ file: 'src/db.ts' }, root); // error lives elsewhere
    expect(atRecall).toBe(atFailure);
  });
});
