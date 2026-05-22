import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { applyBrokenLinkDecisions } from '../../../../src/sources/anthropic-skill-pack/apply-decisions.js';
import type { AggregateResult } from '../../../../src/sources/anthropic-skill-pack/aggregate.js';
import type { BrokenLinkDecision } from '../../../../src/install/prompts/broken-link-prompt.js';
import type { ResolvedLink } from '../../../../src/install/links/resolve-link.js';
import type { ScannedLink } from '../../../../src/install/links/scan-relative-links.js';
import type { CanonicalAgent, CanonicalSkill } from '../../../../src/core/types.js';

interface LoggerStub {
  readonly warns: string[];
  readonly logger: { warn: (msg: string) => void };
}

function makeLogger(): LoggerStub {
  const warns: string[] = [];
  return {
    warns,
    logger: {
      warn: (msg: string): void => {
        warns.push(msg);
      },
    },
  };
}

let root = '';

beforeEach(() => {
  root = join(tmpdir(), `am-apply-${randomBytes(8).toString('hex')}`);
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function scanned(path: string, kind: ScannedLink['kind'] = 'inline'): ScannedLink {
  return { raw: path, path, kind };
}

function resolvedLink(
  scannedPath: string,
  classification: ResolvedLink['classification'],
  resolvedRelative: string | null,
  anchor = '',
  kind: ScannedLink['kind'] = 'inline',
): ResolvedLink {
  return {
    link: scanned(scannedPath, kind),
    classification,
    resolvedRelative,
    anchor,
  };
}

function makeSkill(name: string, body: string): CanonicalSkill {
  return {
    source: join(root, 'skills', name, 'SKILL.md'),
    name,
    description: `desc-${name}`,
    body,
    supportingFiles: [],
  };
}

function makeAgent(name: string, body: string): CanonicalAgent {
  return {
    source: join(root, 'agents', `${name}.md`),
    name,
    description: `desc-${name}`,
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: { PostToolUse: [], PreToolUse: [], Stop: [], Notification: [], UserPromptSubmit: [] },
    skills: [],
    memory: '',
    body,
  };
}

function emptyAggregate(): AggregateResult {
  return {
    skills: [],
    agents: [],
    commands: [],
    rules: [],
    dedups: [],
    brokenLinks: [],
  };
}

describe('applyBrokenLinkDecisions — include-resolvable (skills)', () => {
  it('appends supporting file and rewrites the body link for a single resolvable-outside link', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body = 'See [foo](../../references/foo.md) for context.\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink('../../references/foo.md', 'resolvable-outside', 'references/foo.md'),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'include-resolvable' },
    ];

    const { logger } = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger,
    });

    expect(out.skills).toHaveLength(1);
    const result = out.skills[0]!;
    expect(result.supportingFiles).toHaveLength(1);
    expect(result.supportingFiles[0]!.relativePath).toBe('references/foo.md');
    expect(result.supportingFiles[0]!.absolutePath).toBe(targetAbs);
    expect(result.supportingFiles[0]!.content).toBe('# Foo\n');
    expect(result.body).toBe('See [foo](./references/foo.md) for context.\n');
  });

  it('preserves #anchor when rewriting the link to a local path', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body = 'See [foo](../../references/foo.md#section) for context.\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink(
              '../../references/foo.md#section',
              'resolvable-outside',
              'references/foo.md',
              '#section',
            ),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'include-resolvable' },
    ];

    const { logger } = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger,
    });

    expect(out.skills[0]!.body).toBe('See [foo](./references/foo.md#section) for context.\n');
  });

  it('rewrites all occurrences when same destination appears in inline + reference-def in one body', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body =
      'Inline [foo](../../references/foo.md) and ref [foo][f].\n\n[f]: ../../references/foo.md\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink('../../references/foo.md', 'resolvable-outside', 'references/foo.md'),
            resolvedLink(
              '../../references/foo.md',
              'resolvable-outside',
              'references/foo.md',
              '',
              'reference-def',
            ),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'include-resolvable' },
    ];

    const { logger } = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger,
    });

    expect(out.skills[0]!.body).toBe(
      'Inline [foo](./references/foo.md) and ref [foo][f].\n\n[f]: ./references/foo.md\n',
    );
    // Single supportingFile entry — even though the link appeared twice.
    expect(out.skills[0]!.supportingFiles).toHaveLength(1);
  });

  it('leaves unresolvable links as warnings even when decision is include-resolvable', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body =
      'Resolvable [foo](../../references/foo.md) and missing [bar](../../references/missing.md).\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink('../../references/foo.md', 'resolvable-outside', 'references/foo.md'),
            resolvedLink('../../references/missing.md', 'unresolvable', null),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'include-resolvable' },
    ];

    const stub = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger: stub.logger,
    });

    expect(out.skills[0]!.body).toBe(
      'Resolvable [foo](./references/foo.md) and missing [bar](../../references/missing.md).\n',
    );
    expect(out.skills[0]!.supportingFiles).toHaveLength(1);
    expect(out.skills[0]!.supportingFiles[0]!.relativePath).toBe('references/foo.md');
    // Exactly one warning was emitted for the unresolvable link.
    expect(stub.warns).toHaveLength(1);
    expect(stub.warns[0]).toContain('../../references/missing.md');
  });

  it('does not rewrite occurrences of the link path inside fenced code blocks', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body = [
      'Prose link: [foo](../../references/foo.md)',
      '',
      '```md',
      'Example: [foo](../../references/foo.md)',
      '```',
      '',
    ].join('\n');
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink('../../references/foo.md', 'resolvable-outside', 'references/foo.md'),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'include-resolvable' },
    ];

    const { logger } = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger,
    });

    const resultBody = out.skills[0]!.body;
    // Prose link rewritten to the local supporting file.
    expect(resultBody).toContain('Prose link: [foo](./references/foo.md)');
    // Code-fenced occurrence stays verbatim — the naive string.replace
    // would have rewritten this destination as well.
    expect(resultBody).toContain('Example: [foo](../../references/foo.md)');
  });
});

describe('applyBrokenLinkDecisions — include-resolvable (non-skills)', () => {
  it('downgrades agent decision to warnings (no supportingFiles for non-skills); body unchanged', async () => {
    const targetAbs = join(root, 'references', 'foo.md');
    mkdirSync(join(root, 'references'), { recursive: true });
    writeFileSync(targetAbs, '# Foo\n');

    const body = 'See [foo](../references/foo.md) for context.\n';
    const agent = makeAgent('reviewer', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      agents: [agent],
      brokenLinks: [
        {
          entityKind: 'agent',
          entityName: 'reviewer',
          resolved: [
            resolvedLink('../references/foo.md', 'resolvable-outside', 'references/foo.md'),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'agent', entityName: 'reviewer', action: 'include-resolvable' },
    ];

    const stub = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger: stub.logger,
    });

    // Body untouched (non-skills do not get supportingFiles).
    expect(out.agents[0]!.body).toBe(body);
    expect(stub.warns).toHaveLength(1);
    expect(stub.warns[0]).toContain('../references/foo.md');
  });
});

describe('applyBrokenLinkDecisions — leave-with-warnings', () => {
  it('emits one warn per link and does not mutate the entity', async () => {
    const body = 'See [foo](../foo.md) and [bar](../bar.md).\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [
            resolvedLink('../foo.md', 'unresolvable', null),
            resolvedLink('../bar.md', 'unresolvable', null),
          ],
        },
      ],
    };
    const decisions: BrokenLinkDecision[] = [
      { entityKind: 'skill', entityName: 'lint', action: 'leave-with-warnings' },
    ];

    const stub = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions,
      logger: stub.logger,
    });

    expect(out.skills[0]!.body).toBe(body);
    expect(out.skills[0]!.supportingFiles).toEqual([]);
    expect(stub.warns).toHaveLength(2);
  });
});

describe('applyBrokenLinkDecisions — empty decisions', () => {
  it('returns the aggregate unchanged when decisions array is empty', async () => {
    const body = 'See [foo](../foo.md) for context.\n';
    const skill = makeSkill('lint', body);
    const aggregate: AggregateResult = {
      ...emptyAggregate(),
      skills: [skill],
      brokenLinks: [
        {
          entityKind: 'skill',
          entityName: 'lint',
          resolved: [resolvedLink('../foo.md', 'unresolvable', null)],
        },
      ],
    };

    const stub = makeLogger();
    const out = await applyBrokenLinkDecisions({
      contentRoot: root,
      aggregate,
      decisions: [],
      logger: stub.logger,
    });

    expect(out.skills[0]!.body).toBe(body);
    expect(out.skills[0]!.supportingFiles).toEqual([]);
    expect(stub.warns).toEqual([]);
  });
});
