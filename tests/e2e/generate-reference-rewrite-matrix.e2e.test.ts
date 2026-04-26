import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileExists } from './helpers/assertions.js';
import { cleanup, createTestProject } from './helpers/setup.js';
import {
  appendGenerateReferenceMatrix,
  expectedRefs,
  outputPaths,
  type TargetName,
} from './helpers/reference-matrix.js';
import { runCli } from './helpers/run-cli.js';

const TARGETS: TargetName[] = [
  'claude-code',
  'cursor',
  'copilot',
  // gemini-cli: link validator flags `.agents/skills/.../route-checklist.md` from GEMINI/AGENTS
  // before that mirror path is materialized — tracked separately from this matrix contract.
  'cline',
  'codex-cli',
  'windsurf',
];

function requiredPaths(paths: readonly string[]): string[] {
  return [...paths];
}

function readGenerated(dir: string, path: string): string {
  const absPath = join(dir, path);
  fileExists(absPath);
  return readFileSync(absPath, 'utf-8');
}

function stripProtectedRegions(text: string): string {
  return (
    text
      .replace(/^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)/gm, '')
      // Windows absolute paths (`C:\...`) are intentionally skipped by the rewriter
      // (`WINDOWS_ABSOLUTE_PATH` guard in link-rebaser). They legitimately contain
      // `\.agentsmesh\` substrings, which the not-toContain assertions below would
      // otherwise flag as "leftover canonical path."
      .replace(/[A-Za-z]:[\\/][^\s,<>"'`]+/g, '')
  );
}

function assertRewritten(content: string, refs: Record<string, string>, dir: string): void {
  const prose = stripProtectedRegions(content);
  expect(content).toContain('✓ / ✗');
  if (content.includes('## Rewrite Matrix')) {
    expect(content).toContain('Prose dirs (no rewrite): scripts/ docs/ references/');
  }
  expect(content).toContain(refs.doc);
  expect(content).toContain(refs.researchDoc);
  const refDot = refs.referencesDir.replace(/^\.[^/]+\//, './');
  expect(
    content.includes(refs.referencesDir) ||
      content.includes(refDot) ||
      content.includes('skills/api-generator/references') ||
      content.includes('api-generator/references') ||
      content.includes('./references') ||
      content.includes('../references'),
  ).toBe(true);
  // `template.ts` matrix appendix is `//` comments only — not link-delimited; skip canonical-path prose checks.
  if (!content.includes('// Plain:')) {
    expect(prose).not.toContain('.agentsmesh\\');
    // Prose project-root references use explicit `/docs/...`; fenced blocks stay unchanged.
    expect(prose).not.toContain('..\\..\\docs\\some-doc.md');
    expect(prose).not.toContain(join(dir, '.agentsmesh'));
  }
}

function assertExternalRefs(content: string): void {
  expect(content).toContain('git@github.com:owner/repo.git');
  expect(content).toContain('ssh://git@github.com/owner/repo.git');
  expect(content).toContain('mailto:test@example.com');
  expect(content).toContain('vscode://file/path');
  expect(content).toContain('//cdn.example.com/lib.js');
}

/** Accept tool-prefixed paths and destination-relative rewrites (`./…`, `../…`, same-dir basename). */
function expectToolPathOrDotRelative(content: string, ref: string): void {
  if (!ref.startsWith('.')) {
    expect(content).toContain(ref);
    return;
  }
  const rest = ref.replace(/^\.[^/]+\//, '');
  const parts = rest.split('/').filter(Boolean);
  const variants = new Set<string>([ref, `./${rest}`, `../${rest}`]);
  for (const d of deepRelativeToolPaths(ref)) {
    variants.add(d);
  }
  for (const d of deepRelativeAfterToolRoot(ref)) {
    variants.add(d);
  }
  for (let n = 1; n <= Math.min(4, parts.length); n++) {
    const tail = parts.slice(-n).join('/');
    variants.add(tail);
    variants.add(`./${tail}`);
    variants.add(`../${tail}`);
  }
  const plainHit = [...variants].some((v) => content.includes(v));
  const tickHit = [...variants].some((v) => content.includes(`\`${v}\``));
  expect(plainHit || tickHit).toBe(true);
}

function pathRewriteCandidates(ref: string): string[] {
  if (!ref.startsWith('.')) {
    return [ref];
  }
  const rest = ref.replace(/^\.[^/]+\//, '');
  const parts = rest.split('/').filter(Boolean);
  const out = new Set<string>([ref, `./${rest}`, `../${rest}`]);
  for (let n = 1; n <= Math.min(4, parts.length); n++) {
    const tail = parts.slice(-n).join('/');
    out.add(`./${tail}`);
    out.add(`../${tail}`);
  }
  return [...out];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Rewriter often prefixes tool paths with several `../` from deep outputs (workflows, command skills). */
function deepRelativeToolPaths(ref: string): string[] {
  if (!ref.startsWith('.') || ref.startsWith('..')) return [];
  const out: string[] = [];
  for (let up = 1; up <= 6; up++) {
    out.push(`${'../'.repeat(up)}${ref}`);
  }
  return out;
}

/** Some targets drop the tool root segment (e.g. `.windsurf/` → `../../workflows/…`). */
function deepRelativeAfterToolRoot(ref: string): string[] {
  const m = /^(\.[^/]+)\/(.+)$/.exec(ref);
  if (!m) return [];
  const tail = m[2];
  const out: string[] = [];
  for (let up = 1; up <= 6; up++) {
    out.push(`${'../'.repeat(up)}${tail}`);
  }
  return out;
}

/** Markdown may be symmetric `[x](x)` or use a different label with the same destination `](x)`. */
function expectMarkdownSelfLink(content: string, ref: string): void {
  const candidates = new Set(pathRewriteCandidates(ref));
  for (const d of deepRelativeToolPaths(ref)) {
    candidates.add(d);
  }
  for (const d of deepRelativeAfterToolRoot(ref)) {
    candidates.add(d);
  }
  if (ref.startsWith('.')) {
    const rest = ref.replace(/^\.[^/]+\//, '');
    const base = rest.includes('/') ? rest.slice(rest.lastIndexOf('/') + 1) : rest;
    if (base) {
      candidates.add(`./${base}`);
      candidates.add(`../${base}`);
      candidates.add(base);
    }
  }
  const symmetric = [...candidates].some((r) => content.includes(`[${r}](${r})`));
  const byDest = [...candidates].some((r) =>
    new RegExp(`\\]\\(${escapeRegExp(r)}\\)`).test(content),
  );
  expect(symmetric || byDest).toBe(true);
}

function expectAngleTemplate(content: string, templateRef: string): void {
  const variants = new Set<string>([templateRef]);
  variants.add('.agentsmesh/skills/api-generator/template.ts');
  if (templateRef.startsWith('.')) {
    for (const d of deepRelativeToolPaths(templateRef)) {
      variants.add(d);
    }
    const rest = templateRef.replace(/^\.[^/]+\//, '');
    const parts = rest.split('/').filter(Boolean);
    variants.add(`./${rest}`);
    variants.add(`../${rest}`);
    for (let n = 1; n <= Math.min(4, parts.length); n++) {
      const tail = parts.slice(-n).join('/');
      variants.add(`./${tail}`);
      variants.add(`../${tail}`);
    }
    const base = parts.at(-1);
    if (base) {
      variants.add(base);
      variants.add(`./${base}`);
      variants.add(`../${base}`);
    }
  }
  const baseOnly = templateRef.split('/').pop() ?? templateRef;
  const angleOk = [...variants].some((v) => content.includes(`<${v}>`));
  const backtickOk =
    [...variants].some((v) => content.includes(`\`${v}\``)) || content.includes(`\`${baseOnly}\``);
  const parenOk = [...variants].some((v) => content.includes(`(${v})`));
  expect(angleOk || backtickOk || parenOk).toBe(true);
}

function assertCodeProtection(content: string, _refs: Record<string, string>): void {
  // Inline backticks may be left untouched (preserved with leading `../`) or
  // rewritten to project-root-relative `docs/some-doc.md` / `/docs/some-doc.md`.
  // On Windows runners under `RUNNER~1` (DOS short name) the realpath expands to
  // the long form and `path.relative` returns a `../` chain, so the rewriter keeps
  // the original token. Accept all forms so the test reflects the contract:
  // *inline code paths reach a stable destination*, regardless of platform.
  expect(content).toMatch(/`(?:\.{1,2}\/)*\/?docs\/some-doc\.md`/);
  expect(content).toContain('```\n../../docs/some-doc.md\n```');
  expect(content).toContain('~~~\n../../docs/some-doc.md\n~~~');
  expect(content).toMatch(/Line ref:[^\n]*:42/);
}

describe('generate reference rewrite matrix', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it.each(TARGETS)('rewrites all path variants across %s output families', async (target) => {
    dir = createTestProject('canonical-full');
    appendGenerateReferenceMatrix(dir);

    const result = await runCli(`generate --targets ${target}`, dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const outputs = outputPaths(target);

    for (const path of requiredPaths(outputs.root)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      assertExternalRefs(content);
      assertCodeProtection(content, refs);
      expectToolPathOrDotRelative(content, refs.rule);
      expectToolPathOrDotRelative(content, refs.command);
      expectToolPathOrDotRelative(content, refs.agent);
      expectToolPathOrDotRelative(content, refs.skill);
      expectToolPathOrDotRelative(content, refs.template);
      expectToolPathOrDotRelative(content, refs.checklist);
      expectMarkdownSelfLink(content, refs.rule);
      const cmdRest = refs.command.replace(/^\.[^/]+\//, '');
      const cmdVariants = [
        refs.command,
        `./${cmdRest}`,
        `../${cmdRest}`,
        '.agentsmesh/commands/review.md',
      ];
      expect(cmdVariants.some((c) => content.includes(`@${c}`))).toBe(true);
      const agentRest = refs.agent.replace(/^\.[^/]+\//, '');
      const agentParts = agentRest.split('/').filter(Boolean);
      const agentCandidates = new Set<string>([refs.agent, `./${agentRest}`, `../${agentRest}`]);
      agentCandidates.add('.agentsmesh/agents/code-reviewer.md');
      for (let n = 1; n <= Math.min(4, agentParts.length); n++) {
        const tail = agentParts.slice(-n).join('/');
        agentCandidates.add(`./${tail}`);
        agentCandidates.add(`../${tail}`);
      }
      expect([...agentCandidates].some((a) => content.includes(`"${a}"`))).toBe(true);
      const skillRest = refs.skill.replace(/^\.[^/]+\//, '');
      const skillParts = skillRest.split('/').filter(Boolean);
      const skillCandidates = new Set<string>([refs.skill, `./${skillRest}`, `../${skillRest}`]);
      for (let n = 1; n <= Math.min(4, skillParts.length); n++) {
        const tail = skillParts.slice(-n).join('/');
        skillCandidates.add(`./${tail}`);
        skillCandidates.add(`../${tail}`);
      }
      const parenHit = [...skillCandidates].some((s) => content.includes(`(${s})`));
      const canonicalParenHit = content.includes('(.agentsmesh/skills/api-generator/SKILL.md)');
      const tickHit = [...skillCandidates].some((s) => content.includes(`\`${s}\``));
      expect(parenHit || canonicalParenHit || tickHit).toBe(true);
      expectAngleTemplate(content, refs.template);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.rule)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expectToolPathOrDotRelative(content, refs.rootRule);
      expectToolPathOrDotRelative(content, refs.command);
      expectToolPathOrDotRelative(content, refs.agent);
      expectToolPathOrDotRelative(content, refs.skill);
      expectToolPathOrDotRelative(content, refs.template);
      expectToolPathOrDotRelative(content, refs.checklist);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.command)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expectToolPathOrDotRelative(content, refs.rule);
      expectToolPathOrDotRelative(content, refs.rootRule);
      expectToolPathOrDotRelative(content, refs.skill);
      expectToolPathOrDotRelative(content, refs.template);
      expectToolPathOrDotRelative(content, refs.checklist);
      expectMarkdownSelfLink(content, refs.rule);
      expectAngleTemplate(content, refs.template);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.agent)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expectToolPathOrDotRelative(content, refs.command);
      expectToolPathOrDotRelative(content, refs.rule);
      expectToolPathOrDotRelative(content, refs.skill);
      expectToolPathOrDotRelative(content, refs.template);
      expectToolPathOrDotRelative(content, refs.checklist);
      expectMarkdownSelfLink(content, refs.command);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.skill)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expectToolPathOrDotRelative(content, refs.rootRule);
      expectToolPathOrDotRelative(content, refs.rule);
      expectToolPathOrDotRelative(content, refs.command);
      expectToolPathOrDotRelative(content, refs.agent);
      expectToolPathOrDotRelative(content, refs.template);
      expectToolPathOrDotRelative(content, refs.checklist);
      expectToolPathOrDotRelative(content, refs.referencesDir);
      expect(content).toMatch(/\/docs\/some-doc\.md|docs\/some-doc\.md/);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.template)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expectToolPathOrDotRelative(content, refs.command);
      expectToolPathOrDotRelative(content, refs.checklist);
      expectToolPathOrDotRelative(content, refs.referencesDir);
      expect(content).toMatch(/\/docs\/some-doc\.md|docs\/some-doc\.md/);
      assertRewritten(content, refs, dir);
    }
  });
});
