/**
 * Unit tests for help output.
 */

import { describe, it, expect } from 'vitest';
import { printHelp, printCommandHelp } from '../../../src/cli/help.js';

describe('printHelp', () => {
  it('prints main help with commands and flags', () => {
    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      printHelp();
      expect(output).toContain('agentsbridge');
      expect(output).toContain('init');
      expect(output).toContain('generate');
      expect(output).toContain('import');
      expect(output).toContain('install');
      expect(output).toContain('--targets');
      expect(output).toContain('--refresh-cache');
    } finally {
      process.stdout.write = write;
    }
  });
});

describe('printCommandHelp', () => {
  it('prints per-command help', () => {
    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      printCommandHelp('generate');
      expect(output).toContain('agentsbridge generate');
      expect(output).toContain('Command flags:');
    } finally {
      process.stdout.write = write;
    }
  });

  it('prints install help with --path, --target, --as, and --sync', () => {
    let output = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    try {
      printCommandHelp('install');
      expect(output).toContain('agentsbridge install');
      expect(output).toContain('--path');
      expect(output).toContain('--target');
      expect(output).toContain('--as');
      expect(output).toContain('--sync');
      expect(output).toContain('extends.target');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--force');
    } finally {
      process.stdout.write = write;
    }
  });
});
