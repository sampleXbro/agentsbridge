import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/cli/index.js';

describe('parseArgs', () => {
  it('parses command name', () => {
    const result = parseArgs(['generate']);
    expect(result.command).toBe('generate');
    expect(result.args).toEqual([]);
  });

  it('collects positional args after command', () => {
    const result = parseArgs(['install', 'https://github.com/o/r/tree/main/skills', '--dry-run']);
    expect(result.command).toBe('install');
    expect(result.args).toEqual(['https://github.com/o/r/tree/main/skills']);
    expect(result.flags['dry-run']).toBe(true);
  });

  it('returns "help" when no args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('help');
    expect(result.args).toEqual([]);
  });

  it('parses --flag value pairs', () => {
    const result = parseArgs(['generate', '--targets', 'claude-code,cursor']);
    expect(result.flags.targets).toBe('claude-code,cursor');
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['generate', '--dry-run', '--verbose']);
    expect(result.flags['dry-run']).toBe(true);
    expect(result.flags.verbose).toBe(true);
  });

  it('accumulates a repeated flag into an array (multiple --trigger-file are preserved)', () => {
    const result = parseArgs(['lessons', 'add', 'x', '--trigger-file', 'a', '--trigger-file', 'b']);
    expect(result.flags['trigger-file']).toEqual(['a', 'b']);
  });

  it('keeps a single occurrence as a plain string (not an array)', () => {
    const result = parseArgs(['lessons', 'add', 'x', '--trigger-file', 'a']);
    expect(result.flags['trigger-file']).toBe('a');
  });

  it('appends a third+ occurrence onto the accumulated array', () => {
    const result = parseArgs(['lessons', 'add', 'x', '--tf', 'a', '--tf', 'b', '--tf', 'c']);
    expect(result.flags.tf).toEqual(['a', 'b', 'c']);
  });

  it('a repeated boolean flag stays the latest boolean (not an array)', () => {
    const result = parseArgs(['generate', '--verbose', '--verbose']);
    expect(result.flags.verbose).toBe(true);
  });

  it('parses --version flag as command', () => {
    const result = parseArgs(['--version']);
    expect(result.command).toBe('version');
  });

  it('parses --help flag as command', () => {
    const result = parseArgs(['--help']);
    expect(result.command).toBe('help');
  });

  it('parses --from flag for import', () => {
    const result = parseArgs(['import', '--from', 'claude-code']);
    expect(result.command).toBe('import');
    expect(result.flags.from).toBe('claude-code');
  });

  it('parses install --as and --sync flags', () => {
    const result = parseArgs(['install', '--sync', '--as', 'agents']);
    expect(result.command).toBe('install');
    expect(result.flags.sync).toBe(true);
    expect(result.flags.as).toBe('agents');
  });

  it('parses the --global flag for scoped commands', () => {
    const result = parseArgs(['generate', '--global', '--targets', 'claude-code']);
    expect(result.command).toBe('generate');
    expect(result.flags.global).toBe(true);
    expect(result.flags.targets).toBe('claude-code');
  });
});
