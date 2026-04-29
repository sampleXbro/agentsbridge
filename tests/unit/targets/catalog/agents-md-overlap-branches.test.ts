import { describe, it, expect } from 'vitest';
import { preferEquivalentCodexAgents } from '../../../../src/targets/catalog/agents-md-overlap.js';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

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

const config: ValidatedConfig = {
  version: 1,
  targets: ['codex-cli', 'cursor', 'cline', 'windsurf', 'gemini-cli', 'kiro', 'claude-code'],
  features: ['rules'],
  extends: [],
  overrides: {},
  collaboration: { strategy: 'merge', lock_features: [] },
} as ValidatedConfig;

function makeResult(overrides: Partial<GenerateResult>): GenerateResult {
  return {
    target: 'claude-code',
    path: '.claude/CLAUDE.md',
    content: '',
    status: 'created',
    ...overrides,
  };
}

describe('preferEquivalentCodexAgents — branch coverage', () => {
  it('drops cursor AGENTS.md when other (non-cursor) target also writes the same path', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'cursor', path: 'AGENTS.md', content: '# A' }),
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# A' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['codex-cli']);
  });

  it('keeps cursor AGENTS.md when only cursor writes AGENTS.md', () => {
    const out = preferEquivalentCodexAgents(
      [makeResult({ target: 'cursor', path: 'AGENTS.md', content: '# A' })],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['cursor']);
  });

  it('drops gemini-cli AGENTS.md when codex/other non-{cursor,gemini} writes path', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'gemini-cli', path: 'AGENTS.md', content: '# A' }),
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# A' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['codex-cli']);
  });

  it('keeps gemini-cli AGENTS.md when only cursor and gemini-cli overlap (compat-only)', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'cursor', path: 'AGENTS.md', content: '# A' }),
        makeResult({ target: 'gemini-cli', path: 'AGENTS.md', content: '# A' }),
      ],
      emptyCanonical(),
      config,
    );
    // cursor is dropped because gemini-cli (non-cursor) is also there.
    // gemini-cli is kept since the only overlap targets are {cursor, gemini-cli}.
    expect(out.map((r) => r.target).sort()).toEqual(['gemini-cli']);
  });

  it('passes through non-AGENTS.md results untouched', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'cursor', path: '.cursor/rules/x.md', content: 'a' }),
        makeResult({ target: 'codex-cli', path: '.codex/instructions/x.md', content: 'b' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out).toHaveLength(2);
  });

  it('drops cline AGENTS.md when codex AGENTS.md also exists (compatibility branch)', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# Root' }),
        makeResult({ target: 'cline', path: 'AGENTS.md', content: '# Root' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['codex-cli']);
  });

  it('drops windsurf AGENTS.md when codex AGENTS.md exists', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# A' }),
        makeResult({ target: 'windsurf', path: 'AGENTS.md', content: '# A' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['codex-cli']);
  });

  it('keeps kiro AGENTS.md when no codex AGENTS.md exists', () => {
    const out = preferEquivalentCodexAgents(
      [makeResult({ target: 'kiro', path: 'AGENTS.md', content: '# K' })],
      emptyCanonical(),
      config,
    );
    expect(out).toHaveLength(1);
  });

  it('keeps kiro AGENTS.md when codex content is a strict superset (canonical)', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# K\n\nMore.\n' }),
        makeResult({ target: 'kiro', path: 'AGENTS.md', content: '# K' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target)).toEqual(['codex-cli']);
  });

  it('keeps kiro AGENTS.md when codex content differs and is not a superset', () => {
    const out = preferEquivalentCodexAgents(
      [
        makeResult({ target: 'codex-cli', path: 'AGENTS.md', content: '# DIFF' }),
        makeResult({ target: 'kiro', path: 'AGENTS.md', content: '# K' }),
      ],
      emptyCanonical(),
      config,
    );
    expect(out.map((r) => r.target).sort()).toEqual(['codex-cli', 'kiro']);
  });

  it('keeps non-overlap targets even when AGENTS.md from those targets', () => {
    const out = preferEquivalentCodexAgents(
      [makeResult({ target: 'claude-code', path: 'AGENTS.md', content: 'x' })],
      emptyCanonical(),
      config,
    );
    expect(out).toHaveLength(1);
  });
});
