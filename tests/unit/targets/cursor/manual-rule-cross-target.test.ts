/**
 * Cross-target scope preservation: a Cursor rule with
 * `alwaysApply: false` and no globs/description is a Manual rule that only
 * activates when @-mentioned. Re-emitting that rule to a target that loads
 * every rule unconditionally (Claude Code, Codex CLI, etc.) inverts the
 * activation semantic from "never auto-load" to "always auto-load".
 *
 * Contract:
 * 1. The Cursor importer maps Manual rules to canonical `trigger: 'manual'`.
 * 2. The Cursor importer maps Auto-Attached/Agent-Requested/Always rules to
 *    `trigger: 'glob' | 'model_decision' | 'always_on'` respectively.
 * 3. Lint emits a warning when a canonical rule with `trigger: 'manual'` would
 *    be projected by a target that has no manual-activation semantic, so users
 *    are visibly told the rule will become always-on rather than silently
 *    inverted.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importFromCursor } from '../../../../src/targets/cursor/importer.js';
import { lintRuleScopeInversion } from '../../../../src/core/lint/shared/rule-scope-inversion.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

function setupCursorProject(rules: { name: string; frontmatter: string; body: string }[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'am-cursor-manual-'));
  mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
  for (const rule of rules) {
    const content = `---\n${rule.frontmatter}\n---\n${rule.body}`;
    writeFileSync(join(dir, '.cursor', 'rules', `${rule.name}.mdc`), content);
  }
  return dir;
}

async function readCanonicalRule(projectRoot: string, slug: string): Promise<string | null> {
  const path = join(projectRoot, '.agentsmesh', 'rules', `${slug}.md`);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

function makeCanonicalRule(overrides: Partial<CanonicalRule>): CanonicalRule {
  return {
    source: '.agentsmesh/rules/sample.md',
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: 'Speak like a pirate!',
    ...overrides,
  };
}

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('Cursor manual rule cross-target scope (#1515)', () => {
  it('imports alwaysApply:false + no globs + no description as canonical trigger:manual', async () => {
    const projectRoot = setupCursorProject([
      { name: 'pirate', frontmatter: 'alwaysApply: false', body: 'Speak like a pirate!\n' },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'pirate');
      expect(canonical).not.toBeNull();
      expect(canonical).toMatch(/trigger:\s*manual/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('imports alwaysApply:false + globs as canonical trigger:glob', async () => {
    const projectRoot = setupCursorProject([
      {
        name: 'ts-style',
        frontmatter: ['alwaysApply: false', 'globs:', '  - "**/*.ts"'].join('\n'),
        body: 'TypeScript style.\n',
      },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'ts-style');
      expect(canonical).toMatch(/trigger:\s*glob/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('imports alwaysApply:false + description as canonical trigger:model_decision', async () => {
    const projectRoot = setupCursorProject([
      {
        name: 'agent-call',
        frontmatter: ['alwaysApply: false', 'description: Use this when refactoring'].join('\n'),
        body: 'Refactoring helper.\n',
      },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'agent-call');
      expect(canonical).toMatch(/trigger:\s*model_decision/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('does not annotate trigger when alwaysApply:true (root rule)', async () => {
    const projectRoot = setupCursorProject([
      { name: 'root', frontmatter: 'alwaysApply: true', body: 'Always on.\n' },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, '_root');
      expect(canonical).not.toBeNull();
      expect(canonical).not.toMatch(/trigger:\s*manual/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('lintRuleScopeInversion', () => {
  it('warns when a manual-trigger rule is generated for a target without manual semantics', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual', source: '.agentsmesh/rules/x.md' })];
    const diagnostics = lintRuleScopeInversion({ target: 'claude-code', canonical });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.level).toBe('warning');
    expect(diagnostics[0]?.target).toBe('claude-code');
    expect(diagnostics[0]?.message).toMatch(/manual/i);
  });

  it('does not warn when target preserves manual activation (e.g. cursor)', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual' })];
    expect(
      lintRuleScopeInversion({ target: 'cursor', canonical, preservesManualActivation: true }),
    ).toEqual([]);
  });

  it('does not warn for a plugin target that declares preservesManualActivation', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual' })];
    expect(
      lintRuleScopeInversion({ target: 'my-plugin', canonical, preservesManualActivation: true }),
    ).toEqual([]);
  });

  it('warns for a plugin target without preservesManualActivation', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual' })];
    const diagnostics = lintRuleScopeInversion({ target: 'my-plugin', canonical });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.target).toBe('my-plugin');
  });

  it('does not warn when rule has explicit targets and target is not in the list', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual', targets: ['cursor'] })];
    expect(lintRuleScopeInversion({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('does not warn for non-manual triggers', () => {
    const canonical = emptyCanonical();
    canonical.rules = [
      makeCanonicalRule({ trigger: 'glob', globs: ['**/*.ts'] }),
      makeCanonicalRule({ trigger: 'model_decision', description: 'use sometimes' }),
      makeCanonicalRule({ trigger: 'always_on' }),
    ];
    expect(lintRuleScopeInversion({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('does not warn for root rules even if trigger:manual is set', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual', root: true })];
    expect(lintRuleScopeInversion({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('emits one warning per manual rule when multiple manual rules exist', () => {
    const canonical = emptyCanonical();
    canonical.rules = [
      makeCanonicalRule({ trigger: 'manual', source: '.agentsmesh/rules/a.md' }),
      makeCanonicalRule({ trigger: 'manual', source: '.agentsmesh/rules/b.md' }),
    ];
    expect(lintRuleScopeInversion({ target: 'claude-code', canonical })).toHaveLength(2);
  });

  it('warns for claude-code when rule explicitly lists it in targets', () => {
    const canonical = emptyCanonical();
    canonical.rules = [
      makeCanonicalRule({ trigger: 'manual', targets: ['cursor', 'claude-code'] }),
    ];
    const diagnostics = lintRuleScopeInversion({ target: 'claude-code', canonical });
    expect(diagnostics).toHaveLength(1);
  });

  it('does not warn when trigger is undefined (not explicitly manual)', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({})];
    expect(lintRuleScopeInversion({ target: 'claude-code', canonical })).toEqual([]);
  });

  it('warns for rule with empty targets array (applies to all targets)', () => {
    const canonical = emptyCanonical();
    canonical.rules = [makeCanonicalRule({ trigger: 'manual', targets: [] })];
    expect(lintRuleScopeInversion({ target: 'codex-cli', canonical })).toHaveLength(1);
  });
});

describe('Cursor importer trigger derivation edge cases', () => {
  it('treats alwaysApply:false + whitespace-only description as manual', async () => {
    const projectRoot = setupCursorProject([
      {
        name: 'ws-desc',
        frontmatter: ['alwaysApply: false', 'description: "   "'].join('\n'),
        body: 'Content.\n',
      },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'ws-desc');
      expect(canonical).toMatch(/trigger:\s*manual/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('treats missing alwaysApply field as no trigger annotation', async () => {
    const projectRoot = setupCursorProject([
      { name: 'no-field', frontmatter: 'description: A rule', body: 'Content.\n' },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'no-field');
      expect(canonical).not.toBeNull();
      expect(canonical).not.toMatch(/trigger:/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('treats alwaysApply:false + empty globs array as manual', async () => {
    const projectRoot = setupCursorProject([
      {
        name: 'empty-globs',
        frontmatter: ['alwaysApply: false', 'globs: []'].join('\n'),
        body: 'Content.\n',
      },
    ]);
    try {
      await importFromCursor(projectRoot);
      const canonical = await readCanonicalRule(projectRoot, 'empty-globs');
      expect(canonical).toMatch(/trigger:\s*manual/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
