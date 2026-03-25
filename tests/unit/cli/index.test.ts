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
});
