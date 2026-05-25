/**
 * Branch coverage for deterministic paths in
 * `src/install/run/run-install-prompts.ts`. Interactive prompt branches that
 * require a TTY are exercised by integration tests; here we cover:
 *
 *   - `runPromptFlowWithAbort` short-circuit when `discovery.aggregate` is
 *     absent (returns `{ aborted: false }`)
 *   - `runSkillPackPromptFlow` under `bypass: true` when totalCount === 0
 *     (no entities) → discoveredFeatures is empty
 *   - `runSkillPackPromptFlow` under `bypass: true` with entities → returns
 *     them all and computes `discoveredFeatures` from the narrowed set
 *   - `displayNameForContentRoot` non-empty vs empty (fallback)
 */
import { describe, it, expect } from 'vitest';
import {
  displayNameForContentRoot,
  runPromptFlowWithAbort,
  runSkillPackPromptFlow,
} from '../../../src/install/run/run-install-prompts.js';
import type { AggregateResult } from '../../../src/sources/anthropic-skill-pack/aggregate.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

const emptyCanonical: CanonicalFiles = {
  skills: [],
  agents: [],
  commands: [],
  rules: [],
  mcp: null,
  permissions: null,
  hooks: null,
  ignore: [],
};

function makeAggregate(overrides: Partial<AggregateResult> = {}): AggregateResult {
  return {
    skills: [],
    agents: [],
    commands: [],
    rules: [],
    brokenLinks: [],
    ...overrides,
  } as AggregateResult;
}

describe('displayNameForContentRoot', () => {
  it('returns the basename when contentRoot has a path segment', () => {
    expect(displayNameForContentRoot('/tmp/pack/awesome-skills')).toBe('awesome-skills');
  });

  it('falls back to "install source" when basename is empty', () => {
    expect(displayNameForContentRoot('/')).toBe('install source');
  });
});

describe('runPromptFlowWithAbort — early return branch', () => {
  it('returns { aborted: false } without prompting when discovery.aggregate is undefined', async () => {
    const result = await runPromptFlowWithAbort({
      discovery: { narrowed: emptyCanonical },
      contentRoot: '/tmp/whatever',
      bypass: true,
    });
    expect(result).toEqual({ aborted: false });
  });
});

describe('runSkillPackPromptFlow — bypass branches', () => {
  it('returns empty narrowed + no discoveredFeatures when aggregate has zero entities', async () => {
    const aggregate = makeAggregate();
    const result = await runSkillPackPromptFlow({
      contentRoot: '/tmp/pack',
      aggregate,
      narrowed: emptyCanonical,
      bypass: true,
      displayName: 'pack',
    });
    expect(result.discoveredFeatures).toEqual([]);
    expect(result.narrowed.skills).toEqual([]);
    expect(result.narrowed.rules).toEqual([]);
  });

  it('selects all entities under bypass and reports discoveredFeatures sorted by kind', async () => {
    const aggregate = makeAggregate({
      skills: [
        {
          name: 'sk',
          frontmatter: { name: 'sk', description: 'd' },
          body: '',
          supportingFiles: [],
        },
      ],
      rules: [{ source: '/tmp/pack/rules/r1.md', root: false, targets: [], body: '' }],
      commands: [],
      agents: [],
    } as unknown as Partial<AggregateResult>);

    const result = await runSkillPackPromptFlow({
      contentRoot: '/tmp/pack',
      aggregate,
      narrowed: emptyCanonical,
      bypass: true,
      displayName: 'pack',
    });

    expect(result.narrowed.skills.map((s) => s.name)).toEqual(['sk']);
    expect(result.narrowed.rules.length).toBe(1);
    expect(result.discoveredFeatures).toEqual(['skills', 'rules']);
  });
});
