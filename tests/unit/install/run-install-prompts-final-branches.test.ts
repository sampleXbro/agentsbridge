/**
 * Branch coverage for the remaining paths in run-install-prompts.ts:
 *   - broken-link prompt abort -> throws InstallAbortError (line 100)
 *   - bulk prompt abort -> throws InstallAbortError (line 137)
 *   - runPromptFlowWithAbort happy path with aggregate present (lines 172-184)
 *   - runPromptFlowWithAbort catch of InstallAbortError -> aborted: true (185-188)
 *   - runPromptFlowWithAbort re-throw of non-abort errors (189-190)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runPromptFlowWithAbort,
  runSkillPackPromptFlow,
} from '../../../src/install/run/run-install-prompts.js';
import type { AggregateResult } from '../../../src/sources/anthropic-skill-pack/aggregate.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { PromptAdapter } from '../../../src/install/prompts/prompt-types.js';

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

function makeAggregate(over: Partial<AggregateResult> = {}): AggregateResult {
  return {
    skills: [],
    agents: [],
    commands: [],
    rules: [],
    brokenLinks: [],
    ...over,
  } as AggregateResult;
}

// Adapter that scripts a sequence of answers, in order.
function scriptedAdapter(answers: string[]): PromptAdapter {
  let i = 0;
  return {
    ask: () => Promise.resolve(answers[i++] ?? ''),
    write: () => {},
  };
}

describe('runSkillPackPromptFlow — abort branches', () => {
  it('throws InstallAbortError when user aborts at broken-link prompt', async () => {
    const aggregate = makeAggregate({
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'a',
          resolved: [
            {
              link: { path: '../missing.md' },
              classification: 'missing',
            } as unknown as AggregateResult['brokenLinks'][number]['resolved'][number],
          ],
        },
      ] as unknown as AggregateResult['brokenLinks'],
    });

    // Broken-link prompt asks per entity; any non-i/l answer aborts.
    const adapter = scriptedAdapter(['q']);

    await expect(
      runSkillPackPromptFlow({
        contentRoot: '/tmp/pack',
        aggregate,
        narrowed: emptyCanonical,
        bypass: false,
        displayName: 'pack',
        adapter,
      }),
    ).rejects.toThrow(/aborted/i);
  });

  it('throws InstallAbortError when user aborts at bulk-select prompt', async () => {
    const aggregate = makeAggregate({
      skills: [
        {
          name: 'sk',
          frontmatter: { name: 'sk', description: 'd' },
          body: '',
          supportingFiles: [],
        },
      ],
    } as unknown as Partial<AggregateResult>);

    // No broken links, so first ask() targets the bulk-select prompt.
    const adapter = scriptedAdapter(['q']);

    await expect(
      runSkillPackPromptFlow({
        contentRoot: '/tmp/pack',
        aggregate,
        narrowed: emptyCanonical,
        bypass: false,
        displayName: 'pack',
        adapter,
      }),
    ).rejects.toThrow(/aborted/i);
  });
});

describe('runPromptFlowWithAbort — wrapper branches', () => {
  it('returns narrowed + discoveredFeatures when flow succeeds under bypass', async () => {
    const aggregate = makeAggregate({
      skills: [
        {
          name: 'sk',
          frontmatter: { name: 'sk', description: 'd' },
          body: '',
          supportingFiles: [],
        },
      ],
    } as unknown as Partial<AggregateResult>);

    const result = await runPromptFlowWithAbort({
      discovery: { aggregate, narrowed: emptyCanonical },
      contentRoot: '/tmp/pack/folder',
      bypass: true,
    });

    expect(result.aborted).toBe(false);
    expect(result.narrowed?.skills.map((s) => s.name)).toEqual(['sk']);
    expect(result.discoveredFeatures).toEqual(['skills']);
  });

  it('re-throws non-InstallAbort errors from the inner flow', async () => {
    const aggregate = makeAggregate();
    const spy = vi
      .spyOn(
        await import('../../../src/sources/anthropic-skill-pack/apply-decisions.js'),
        'applyBrokenLinkDecisions',
      )
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      runPromptFlowWithAbort({
        discovery: { aggregate, narrowed: emptyCanonical },
        contentRoot: '/tmp/pack',
        bypass: true,
      }),
    ).rejects.toThrow('boom');

    spy.mockRestore();
  });
});
