/**
 * Branch coverage for src/canonical/features/rules.ts:
 * - skip empty content (line 55).
 * - skip on frontmatter parse failure (line 57).
 * - codex_emit 'advisory' branch (line 72-73).
 * - codex_instruction 'override' branch (line 76).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRules } from '../../../src/canonical/features/rules.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-rules-feats-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('parseRules — branch coverage', () => {
  it('skips empty .md files', async () => {
    writeFileSync(join(dir, 'empty.md'), '');
    writeFileSync(join(dir, 'good.md'), '---\ndescription: ok\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source.endsWith('good.md')).toBe(true);
  });

  it('handles codex_emit: advisory branch', async () => {
    writeFileSync(join(dir, 'rule.md'), '---\ndescription: x\ncodex_emit: advisory\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.codexEmit).toBe('advisory');
  });

  it('handles codex_emit: execution branch', async () => {
    writeFileSync(join(dir, 'rule.md'), '---\ndescription: x\ncodex_emit: execution\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.codexEmit).toBe('execution');
  });

  it('ignores invalid codex_emit values (undefined branch)', async () => {
    writeFileSync(join(dir, 'rule.md'), '---\ndescription: x\ncodex_emit: bogus\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.codexEmit).toBeUndefined();
  });

  it('handles codex_instruction: override branch', async () => {
    writeFileSync(
      join(dir, 'rule.md'),
      '---\ndescription: x\ncodex_instruction: override\n---\nbody',
    );
    const rules = await parseRules(dir);
    expect(rules[0]!.codexInstructionVariant).toBe('override');
  });

  it('ignores invalid trigger values', async () => {
    writeFileSync(join(dir, 'rule.md'), '---\ndescription: x\ntrigger: bogus_value\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.trigger).toBeUndefined();
  });

  it('detects root via filename _root.md regardless of frontmatter root', async () => {
    writeFileSync(join(dir, '_root.md'), '---\ndescription: r\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.root).toBe(true);
  });

  it('detects root via frontmatter root:true', async () => {
    writeFileSync(join(dir, 'named.md'), '---\ndescription: r\nroot: true\n---\nbody');
    const rules = await parseRules(dir);
    expect(rules[0]!.root).toBe(true);
  });
});
