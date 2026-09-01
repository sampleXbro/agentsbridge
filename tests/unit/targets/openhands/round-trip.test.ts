/**
 * generate -> write -> import -> generate must be a fixed point in both scopes,
 * and the import leg must never corrupt canonical content OpenHands cannot
 * represent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { GenerateResult } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { TargetLayoutScope } from '../../../../src/targets/catalog/target-descriptor.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

let root = '';

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['openhands'],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
}

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

function flush(results: GenerateResult[]): void {
  for (const result of results) write(result.path, result.content);
}

function seedCanonical(): void {
  write(
    '.agentsmesh/rules/_root.md',
    '---\nroot: true\ndescription: Project standards\n---\n# Root\n\nAlways run the tests.\n',
  );
  write(
    '.agentsmesh/rules/typescript.md',
    "---\nroot: false\ndescription: TypeScript rules\nglobs: ['src/**/*.ts']\n---\n# TypeScript\n\nNo any.\n",
  );
  write(
    '.agentsmesh/commands/review.md',
    '---\ndescription: Review the diff\nallowed-tools:\n  - Read\n---\nReview it.\n',
  );
  write(
    '.agentsmesh/agents/code-reviewer.md',
    '---\ndescription: Reviewer\ntools:\n  - Read\nmodel: sonnet\n---\nYou review.\n',
  );
  write(
    '.agentsmesh/skills/api-generator/SKILL.md',
    '---\nname: api-generator\n---\nBuild APIs.\n',
  );
  write('.agentsmesh/mcp.json', '{"mcpServers":{"srv":{"command":"npx","args":["-y","x"]}}}');
  // A prompt handler and an event OpenHands cannot represent, so the fixed point
  // has to hold across both a lossless and a lossy hook mapping.
  write(
    '.agentsmesh/hooks.yaml',
    "PostToolUse:\n  - matcher: 'Write'\n    command: 'fmt'\n    timeout: 20\n" +
      "Stop:\n  - matcher: '*'\n    command: ''\n    type: prompt\n    prompt: 'Tests green?'\n" +
      "Notification:\n  - matcher: '*'\n    command: 'ping'\n",
  );
}

async function roundTrip(scope: TargetLayoutScope): Promise<void> {
  const first = await generate({
    config: config(),
    canonical: await loadCanonicalFiles(root),
    projectRoot: root,
    scope,
  });
  flush(first);
  await importFromOpenhands(root, { scope });
  const second = await generate({
    config: config(),
    canonical: await loadCanonicalFiles(root),
    projectRoot: root,
    scope,
  });

  expect(second.map((r) => r.path).sort()).toEqual(first.map((r) => r.path).sort());
  for (const result of second) {
    expect(result.content, result.path).toBe(first.find((r) => r.path === result.path)!.content);
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-openhands-rt-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  root = '';
});

describe('openhands round-trip', () => {
  it('is a fixed point at project scope', async () => {
    seedCanonical();
    await roundTrip('project');
    expect(read('.agentsmesh/rules/typescript.md')).toContain('src/**/*.ts');
  });

  it('is a fixed point at global scope', async () => {
    seedCanonical();
    await roundTrip('global');
    expect(read('.agents/skills/_root.md')).not.toContain('---');
  });

  it('keeps the root description in canonical even though AGENTS.md cannot carry it', async () => {
    seedCanonical();
    flush(
      await generate({
        config: config(),
        canonical: await loadCanonicalFiles(root),
        projectRoot: root,
      }),
    );
    expect(read('AGENTS.md').startsWith('---')).toBe(false);

    await importFromOpenhands(root, { scope: 'project' });
    expect(read('.agentsmesh/rules/_root.md')).toContain('Project standards');
  });

  it('keeps the prompt hook and drops only the event OpenHands forbids', async () => {
    seedCanonical();
    flush(
      await generate({
        config: config(),
        canonical: await loadCanonicalFiles(root),
        projectRoot: root,
      }),
    );
    const written = JSON.parse(read('.openhands/hooks.json'));
    expect(Object.keys(written)).toEqual(['post_tool_use', 'stop']);
    expect(written.stop[0].hooks[0]).toEqual({ type: 'prompt', prompt: 'Tests green?' });

    await importFromOpenhands(root, { scope: 'project' });
    expect(read('.agentsmesh/hooks.yaml')).toContain('type: prompt');
    expect(read('.agentsmesh/hooks.yaml')).not.toContain('Notification');
  });

  it('revokes a removed command from the generated plugin directory', async () => {
    seedCanonical();
    flush(
      await generate({
        config: config(),
        canonical: await loadCanonicalFiles(root),
        projectRoot: root,
      }),
    );
    rmSync(join(root, '.agentsmesh/commands/review.md'));
    const results = await generate({
      config: config(),
      canonical: await loadCanonicalFiles(root),
      projectRoot: root,
    });
    expect(results.map((r) => r.path)).not.toContain(
      '.agents/plugins/agentsmesh/commands/review.md',
    );
  });
});
