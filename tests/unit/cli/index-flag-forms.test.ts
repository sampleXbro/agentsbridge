import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/cli/index.js';

describe('parseArgs: --flag=value form', () => {
  it('equals the space-separated form for value flags', () => {
    expect(parseArgs(['generate', '--targets=claude-code'])).toEqual(
      parseArgs(['generate', '--targets', 'claude-code']),
    );
    expect(parseArgs(['import', '--from=cursor']).flags).toEqual({ from: 'cursor' });
  });

  it('coerces boolean flags given as =true / =false', () => {
    expect(parseArgs(['refresh', '--dry-run=true']).flags).toEqual({ 'dry-run': true });
    expect(parseArgs(['refresh', '--dry-run=false']).flags).toEqual({ 'dry-run': false });
    expect(parseArgs(['generate', '--json=true']).flags).toEqual({ json: true });
  });

  it('keeps = inside the value', () => {
    expect(parseArgs(['lessons', 'add', '--rule=a=b']).flags).toEqual({ rule: 'a=b' });
  });
});

describe('parseArgs: boolean flags never swallow a positional', () => {
  it.each([
    [['refresh', '--dry-run', 'my-pack'], { 'dry-run': true }, ['my-pack']],
    [['installs', '--global', 'list'], { global: true }, ['list']],
    [['uninstall', '--dry-run', 'my-pack'], { 'dry-run': true }, ['my-pack']],
    [['install', '--dry-run', './pack'], { 'dry-run': true }, ['./pack']],
    [['check', '--no-outputs', 'extra'], { 'no-outputs': true }, ['extra']],
    [['lessons', 'query', '--always', '--file', 'a.ts'], { always: true, file: 'a.ts' }, ['query']],
  ])('%j', (argv, flags, args) => {
    expect(parseArgs(argv)).toEqual({ command: argv[0], flags, args });
  });

  it('still lets a value flag take the next token', () => {
    expect(parseArgs(['plugin', 'add', 'pkg', '--version', '1.2.3'])).toEqual({
      command: 'plugin',
      flags: { version: '1.2.3' },
      args: ['add', 'pkg'],
    });
  });

  it('keeps the permissive value-hungry behaviour for flags the help table does not know', () => {
    expect(parseArgs(['generate', '--bogus', 'x']).flags).toEqual({ bogus: 'x' });
  });
});
