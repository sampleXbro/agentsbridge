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
  'gemini-cli',
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
  return text.replace(/^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)/gm, '');
}

function assertRewritten(content: string, refs: Record<string, string>, dir: string): void {
  const prose = stripProtectedRegions(content);
  expect(content).toContain('✓ / ✗');
  expect(content).toContain(refs.doc);
  expect(content).toContain(refs.researchDoc);
  expect(content).toContain(refs.referencesDir);
  expect(prose).not.toContain('.agentsmesh/');
  expect(prose).not.toContain('.agentsmesh\\');
  expect(prose).not.toContain('../../docs/some-doc.md');
  expect(prose).not.toContain('../../../../docs/agents-folder-structure-research.md');
  expect(prose).not.toContain('..\\..\\docs\\some-doc.md');
  expect(prose).not.toContain('../skills/api-generator/');
  expect(prose).not.toContain('..\\skills\\api-generator\\');
  expect(prose).not.toContain('../commands/review.md');
  expect(prose).not.toContain('..\\commands\\review.md');
  expect(prose).not.toContain('../agents/code-reviewer.md');
  expect(prose).not.toContain('..\\agents\\code-reviewer.md');
  expect(prose).not.toContain('./typescript.md');
  expect(prose).not.toContain('.agentsmesh\\commands/review.md');
  expect(prose).not.toContain(join(dir, '.agentsmesh'));
}

function assertExternalRefs(content: string): void {
  expect(content).toContain('git@github.com:owner/repo.git');
  expect(content).toContain('ssh://git@github.com/owner/repo.git');
  expect(content).toContain('mailto:test@example.com');
  expect(content).toContain('vscode://file/path');
  expect(content).toContain('//cdn.example.com/lib.js');
}

function assertCodeProtection(content: string, refs: Record<string, string>): void {
  expect(content).toContain(`\`${refs.doc}\``);
  expect(content).toContain('```\n../../docs/some-doc.md\n```');
  expect(content).toContain('~~~\n../../docs/some-doc.md\n~~~');
  expect(content).toContain(`${refs.rule}:42`);
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
      expect(content).toContain(refs.rule);
      expect(content).toContain(refs.command);
      expect(content).toContain(refs.agent);
      expect(content).toContain(refs.skill);
      expect(content).toContain(refs.template);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(`[${refs.rule}](${refs.rule})`);
      expect(content).toContain(`@${refs.command}`);
      expect(content).toContain(`"${refs.agent}"`);
      expect(content).toContain(`(${refs.skill})`);
      expect(content).toContain(`<${refs.template}>`);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.rule)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expect(content).toContain(refs.rootRule);
      expect(content).toContain(refs.command);
      expect(content).toContain(refs.agent);
      expect(content).toContain(refs.skill);
      expect(content).toContain(refs.template);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(`[${refs.rootRule}](${refs.rootRule})`);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.command)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expect(content).toContain(refs.rule);
      expect(content).toContain(refs.rootRule);
      expect(content).toContain(refs.skill);
      expect(content).toContain(refs.template);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(`[${refs.rule}](${refs.rule})`);
      expect(content).toContain(`<${refs.template}>`);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.agent)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expect(content).toContain(refs.command);
      expect(content).toContain(refs.rule);
      expect(content).toContain(refs.skill);
      expect(content).toContain(refs.template);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(`[${refs.command}](${refs.command})`);
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.skill)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expect(content).toContain(refs.rootRule);
      expect(content).toContain(refs.rule);
      expect(content).toContain(refs.command);
      expect(content).toContain(refs.agent);
      expect(content).toContain(refs.template);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(refs.referencesDir);
      expect(content).toContain('docs/some-doc.md');
      assertRewritten(content, refs, dir);
    }

    for (const path of requiredPaths(outputs.template)) {
      const content = readGenerated(dir, path);
      const refs = expectedRefs(target, path);
      expect(content).toContain(refs.rootRule);
      expect(content).toContain(refs.rule);
      expect(content).toContain(refs.command);
      expect(content).toContain(refs.agent);
      expect(content).toContain(refs.skill);
      expect(content).toContain(refs.checklist);
      expect(content).toContain(refs.referencesDir);
      expect(content).toContain('docs/some-doc.md');
      assertRewritten(content, refs, dir);
    }
  });
});
