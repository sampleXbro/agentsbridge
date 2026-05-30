import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLedger, saveLedger, type Ledger } from '../../../src/lessons/ledger.js';

describe('ledger I/O', () => {
  it('round-trips assignments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const path = join(dir, 'ledger.yaml');
    const ledger: Ledger = {
      version: 1,
      assignments: { abc123: 'lessons-foo', def456: 'lessons-bar' },
    };
    saveLedger(path, ledger);
    expect(loadLedger(path)).toEqual(ledger);
  });

  it('returns empty ledger when file does not exist', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'missing.yaml');
    expect(loadLedger(path)).toEqual({ version: 1, assignments: {} });
  });
});
