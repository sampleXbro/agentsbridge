import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../src/utils/output/logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info writes to stdout', () => {
    logger.info('hello');
    expect(process.stdout.write).toHaveBeenCalled();
  });

  it('error writes to stderr', () => {
    logger.error('fail');
    expect(process.stderr.write).toHaveBeenCalled();
  });

  it('success prefixes with checkmark', () => {
    logger.success('done');
    const output = vi.mocked(process.stdout.write).mock.calls[0]?.[0] as string;
    expect(output).toContain('✓');
    expect(output).toContain('done');
  });

  it('warn prefixes with warning symbol', () => {
    logger.warn('careful');
    const output = vi.mocked(process.stderr.write).mock.calls[0]?.[0] as string;
    expect(output).toContain('⚠');
  });

  it('respects NO_COLOR env', () => {
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    logger.info('plain');
    const output = vi.mocked(process.stdout.write).mock.calls[0]?.[0] as string;
    // eslint-disable-next-line no-control-regex -- testing ANSI escape codes
    expect(output).not.toMatch(/\x1b\[/);
    process.env.NO_COLOR = prev;
  });

  it('table formats rows into aligned columns', () => {
    const rows = [
      ['Name', 'Status'],
      ['claude', '✅'],
      ['cursor', '⚠️'],
    ];
    logger.table(rows);
    expect(process.stdout.write).toHaveBeenCalled();
  });

  it('table with empty rows does nothing', () => {
    logger.table([]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('debug writes when AGENTSMESH_DEBUG=1', () => {
    const prev = process.env.AGENTSMESH_DEBUG;
    process.env.AGENTSMESH_DEBUG = '1';
    logger.debug('trace');
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('[debug]'));
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('trace'));
    process.env.AGENTSMESH_DEBUG = prev;
  });

  it('debug does nothing when AGENTSMESH_DEBUG not set', () => {
    const prev = process.env.AGENTSMESH_DEBUG;
    delete process.env.AGENTSMESH_DEBUG;
    vi.mocked(process.stdout.write).mockClear();
    logger.debug('silent');
    expect(process.stdout.write).not.toHaveBeenCalled();
    if (prev !== undefined) process.env.AGENTSMESH_DEBUG = prev;
  });
});
