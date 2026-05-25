import { describe, it, expect } from 'vitest';
import {
  runBrokenLinkPrompt,
  type EntityWithBrokenLinks,
} from '../../../../src/install/prompts/broken-link-prompt.js';
import type { ResolvedLink } from '../../../../src/install/links/resolve-link.js';
import type { ScannedLink } from '../../../../src/install/links/scan-relative-links.js';
import type { PromptAdapter } from '../../../../src/install/prompts/prompt-types.js';

interface Recorder {
  readonly prompts: string[];
  readonly writes: string[];
  readonly adapter: PromptAdapter;
}

function makeRecorder(answers: readonly string[]): Recorder {
  const prompts: string[] = [];
  const writes: string[] = [];
  let i = 0;
  const ask = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    if (i >= answers.length) return '';
    return answers[i++]!;
  };
  const write = (chunk: string): void => {
    writes.push(chunk);
  };
  return { prompts, writes, adapter: { ask, write } };
}

function scanned(path: string): ScannedLink {
  return { raw: path, path, kind: 'inline' };
}

function resolved(
  raw: string,
  classification: ResolvedLink['classification'],
  resolvedRelative: string | null = `resolved/${raw}`,
): ResolvedLink {
  return {
    link: scanned(raw),
    classification,
    resolvedRelative,
    anchor: '',
  };
}

const TWO_LINKS_AGENT: EntityWithBrokenLinks = {
  entityKind: 'agent',
  entityName: 'code-reviewer',
  resolved: [
    resolved('../references/orchestration-patterns.md', 'resolvable-outside'),
    resolved('../references/missing.md', 'unresolvable', null),
  ],
};

const ONE_LINK_SKILL: EntityWithBrokenLinks = {
  entityKind: 'skill',
  entityName: 'interview-me',
  resolved: [resolved('../templates/intro.md', 'resolvable-outside')],
};

describe('runBrokenLinkPrompt - bypass / non-interactive', () => {
  it('defaults every entity to "leave-with-warnings" when bypass=true', async () => {
    const r = makeRecorder([]);
    const result = await runBrokenLinkPrompt(
      [TWO_LINKS_AGENT, ONE_LINK_SKILL],
      { bypass: true },
      r.adapter,
    );
    expect(result.aborted).toBe(false);
    expect(result.decisions).toHaveLength(2);
    for (const d of result.decisions) {
      expect(d.action).toBe('leave-with-warnings');
    }
    expect(r.prompts).toEqual([]);
  });

  it('emits a warning line per broken link under bypass=true', async () => {
    const r = makeRecorder([]);
    await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: true }, r.adapter);
    const combined = r.writes.join('');
    expect(combined).toContain('../references/orchestration-patterns.md');
    expect(combined).toContain('../references/missing.md');
  });
});

describe('runBrokenLinkPrompt - interactive', () => {
  it("user 'i' on a single entity returns include-resolvable decision", async () => {
    const r = makeRecorder(['i']);
    const result = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r.adapter);
    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([
      {
        entityKind: 'agent',
        entityName: 'code-reviewer',
        action: 'include-resolvable',
      },
    ]);
  });

  it("user 'l' on a single entity returns leave-with-warnings decision", async () => {
    const r = makeRecorder(['l']);
    const result = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r.adapter);
    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([
      {
        entityKind: 'agent',
        entityName: 'code-reviewer',
        action: 'leave-with-warnings',
      },
    ]);
  });

  it("user 'a' aborts immediately and returns no decisions", async () => {
    const r = makeRecorder(['a']);
    const result = await runBrokenLinkPrompt(
      [TWO_LINKS_AGENT, ONE_LINK_SKILL],
      { bypass: false },
      r.adapter,
    );
    expect(result.aborted).toBe(true);
    expect(result.decisions).toEqual([]);
    expect(r.prompts).toHaveLength(1);
  });

  it('treats answers case-insensitively (I/L/A)', async () => {
    const r1 = makeRecorder(['I']);
    const result1 = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r1.adapter);
    expect(result1.decisions[0]!.action).toBe('include-resolvable');

    const r2 = makeRecorder(['L']);
    const result2 = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r2.adapter);
    expect(result2.decisions[0]!.action).toBe('leave-with-warnings');

    const r3 = makeRecorder(['A']);
    const result3 = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r3.adapter);
    expect(result3.aborted).toBe(true);
  });

  it('blank input on a prompt aborts the run', async () => {
    const r = makeRecorder(['']);
    const result = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r.adapter);
    expect(result.aborted).toBe(true);
  });

  it('unknown input aborts the run', async () => {
    const r = makeRecorder(['x']);
    const result = await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r.adapter);
    expect(result.aborted).toBe(true);
  });

  it('prompts once per entity in the provided order and respects each choice independently', async () => {
    const r = makeRecorder(['l', 'i']);
    const result = await runBrokenLinkPrompt(
      [TWO_LINKS_AGENT, ONE_LINK_SKILL],
      { bypass: false },
      r.adapter,
    );
    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([
      {
        entityKind: 'agent',
        entityName: 'code-reviewer',
        action: 'leave-with-warnings',
      },
      {
        entityKind: 'skill',
        entityName: 'interview-me',
        action: 'include-resolvable',
      },
    ]);
  });

  it('the per-entity write banner names entity kind, name, link counts and classifications', async () => {
    const r = makeRecorder(['l']);
    await runBrokenLinkPrompt([TWO_LINKS_AGENT], { bypass: false }, r.adapter);
    const combined = r.writes.join('');
    expect(combined).toContain('code-reviewer');
    expect(combined).toContain('agent');
    expect(combined).toContain('../references/orchestration-patterns.md');
    expect(combined).toContain('resolvable-outside');
    expect(combined).toContain('../references/missing.md');
    expect(combined).toContain('unresolvable');
  });

  it('skips entities that have no broken links (defensive)', async () => {
    const clean: EntityWithBrokenLinks = {
      entityKind: 'skill',
      entityName: 'no-issues',
      resolved: [],
    };
    const r = makeRecorder(['l']);
    const result = await runBrokenLinkPrompt(
      [clean, TWO_LINKS_AGENT],
      { bypass: false },
      r.adapter,
    );
    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([
      {
        entityKind: 'agent',
        entityName: 'code-reviewer',
        action: 'leave-with-warnings',
      },
    ]);
    expect(r.prompts).toHaveLength(1);
  });
});

describe('runBrokenLinkPrompt - degenerate inputs', () => {
  it('returns empty decisions without prompting when entity list is empty', async () => {
    const r = makeRecorder([]);
    const result = await runBrokenLinkPrompt([], { bypass: false }, r.adapter);
    expect(result.aborted).toBe(false);
    expect(result.decisions).toEqual([]);
    expect(r.prompts).toEqual([]);
    expect(r.writes).toEqual([]);
  });
});
