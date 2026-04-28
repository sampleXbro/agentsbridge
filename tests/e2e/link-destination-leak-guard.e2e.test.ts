/**
 * Leak guard: canonical `.agentsmesh/...` paths in rule markdown must be
 * rewritten to target-native paths in every generated per-rule output so the
 * agent never sees the canonical source structure.
 *
 * Runs across every built-in target to catch regressions that break rewriting
 * for individual targets.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

const TARGETS = [
  'antigravity',
  'claude-code',
  'cline',
  'codex-cli',
  'continue',
  'copilot',
  'cursor',
  'gemini-cli',
  'junie',
  'kiro',
  'roo-code',
  'windsurf',
] as const;

/**
 * Inline markdown link:  [label](destination "optional title")
 * Reference definition:  [ref]: destination "optional title"
 *
 * Angle-bracket autolinks are intentionally excluded — they sit closer to URIs
 * than to prose-relative paths and have separate coverage in the link-rebaser
 * unit tests.
 */
const MARKDOWN_DEST_PATTERNS: readonly RegExp[] = [
  /\[[^\]]*\]\(([^)\s]+)/g,
  /^\s*\[[^\]]+\]:\s*([^\s]+)/gm,
];

const STRIP_FENCED_RE = /```[\s\S]*?```/g;

interface Leak {
  readonly file: string;
  readonly destination: string;
  readonly snippet: string;
}

function listFilesRecursive(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else out.push(full);
    }
  }
  walk(root);
  return out;
}

/**
 * Per-target rules output directories. Aggregated mirrors (Cursor `AGENTS.md`,
 * Gemini `GEMINI.md`, etc.) embed rule prose into a single root file and are
 * tracked separately by `tests/unit/core/generate-reference-rewrite*.test.ts`.
 * This e2e test scopes to the per-rule output files so the canonical
 * "rule-to-rule reference rewrite" contract is verified
 * across every built-in target without conflating with the aggregator outputs.
 */
const TARGET_RULES_DIRS: Record<string, readonly string[]> = {
  antigravity: ['.agents/rules', '.gemini/antigravity/rules'],
  'claude-code': ['.claude/rules', '.agents/rules'],
  cline: ['.clinerules'],
  'codex-cli': ['.codex/rules', '.agents/rules'],
  continue: ['.continue/rules'],
  copilot: ['.github/instructions', '.github/copilot'],
  cursor: ['.cursor/rules'],
  'gemini-cli': ['.gemini/rules'],
  junie: ['.junie/rules'],
  kiro: ['.kiro/steering'],
  'roo-code': ['.roo/rules'],
  windsurf: ['.windsurf/rules'],
};

function collectLeaks(dir: string, target: string): Leak[] {
  const leaks: Leak[] = [];
  const allowDirs = TARGET_RULES_DIRS[target] ?? [];
  const files = listFilesRecursive(dir).filter((f) => {
    const rel = relative(dir, f);
    if (rel.startsWith(`.agentsmesh${sep}`)) return false;
    if (!/\.(md|mdc|mdx|markdown)$/i.test(rel)) return false;
    return allowDirs.some((d) => rel.startsWith(d.split('/').join(sep) + sep));
  });
  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const stripped = raw.replace(STRIP_FENCED_RE, '');
    for (const re of MARKDOWN_DEST_PATTERNS) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(stripped)) !== null) {
        const dest = match[1] ?? '';
        if (!dest.includes('.agentsmesh/')) continue;
        leaks.push({
          file: relative(dir, file),
          destination: dest,
          snippet: match[0],
        });
      }
    }
  }
  if (leaks.length > 0) {
    // Annotate with target so the assertion message points the reader at the
    // failing target rather than a generic dump.
    return leaks.map((l) => ({ ...l, file: `[${target}] ${l.file}` }));
  }
  return leaks;
}

function writeProject(dir: string, target: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    `version: 1\ntargets: [${target}]\nfeatures: [rules]\n`,
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    [
      '---',
      'root: true',
      'description: Root rule',
      '---',
      '# Root',
      '',
      'See [typescript style](.agentsmesh/rules/typescript.md) for details.',
      '',
      '[ts]: .agentsmesh/rules/typescript.md',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', 'typescript.md'),
    [
      '---',
      'description: TypeScript rule',
      '---',
      'Inline link to a sibling rule [naming](.agentsmesh/rules/naming.md).',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', 'naming.md'),
    ['---', 'description: Naming rule', '---', 'Use kebab-case.', ''].join('\n'),
  );
}

describe('generated markdown destinations never leak .agentsmesh/ paths', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each(TARGETS)('rewrites .agentsmesh/ link destinations for target=%s', async (target) => {
    dir = createTestProject();
    writeProject(dir, target);

    await runCli(`generate --targets ${target}`, dir);

    const leaks = collectLeaks(dir, target);
    expect(leaks, JSON.stringify(leaks, null, 2)).toEqual([]);
  });
});
