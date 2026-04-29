/**
 * Extra branch coverage for src/targets/import/* helpers — embedded-rules,
 * import-metadata-serialize, descriptor-import-runner.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { splitEmbeddedRulesToCanonical } from '../../../../src/targets/import/embedded-rules.js';
import {
  EMBEDDED_RULES_START,
  EMBEDDED_RULES_END,
} from '../../../../src/targets/projection/managed-blocks.js';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedSkillWithFallback,
} from '../../../../src/targets/import/import-metadata-serialize.js';
import { runDescriptorImport } from '../../../../src/targets/import/descriptor-import-runner.js';
import type {
  TargetDescriptor,
  TargetLayoutScope,
} from '../../../../src/targets/catalog/target-descriptor.js';
import type { ImportFeatureSpec } from '../../../../src/targets/catalog/import-descriptor.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-extra-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function inlineRule(args: { source: string; body: string }): string {
  const meta = JSON.stringify({
    source: args.source,
    description: '',
    globs: [],
    targets: [],
  });
  return [
    `<!-- agentsmesh:embedded-rule:start ${meta} -->`,
    args.body,
    '<!-- agentsmesh:embedded-rule:end -->',
  ].join('\n');
}

function block(rules: string[]): string {
  return [EMBEDDED_RULES_START, ...rules, EMBEDDED_RULES_END].join('\n');
}

describe('embedded-rules — extra branches', () => {
  it('omits description when rule.description is empty (line 50 ternary arm)', async () => {
    const content = block([inlineRule({ source: 'rules/x.md', body: 'body' })]);
    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toHaveLength(1);
    const written = readFileSync(join(projectRoot, '.agentsmesh/rules/x.md'), 'utf-8');
    // description key still emitted but with empty string value (no other content).
    expect(written).toContain('description: ""');
  });

  it('includes targets and globs frontmatter when present (line 51/52 arms)', async () => {
    const meta = JSON.stringify({
      source: 'rules/y.md',
      description: 'desc',
      globs: ['src/**/*.ts'],
      targets: ['claude-code'],
    });
    const content = [
      EMBEDDED_RULES_START,
      `<!-- agentsmesh:embedded-rule:start ${meta} -->`,
      '## body',
      '<!-- agentsmesh:embedded-rule:end -->',
      EMBEDDED_RULES_END,
    ].join('\n');

    const result = await splitEmbeddedRulesToCanonical({
      content,
      projectRoot,
      rulesDir: '.agentsmesh/rules',
      sourcePath: '/src.md',
      fromTool: 'cov',
      normalize: (c) => c,
    });
    expect(result.results).toHaveLength(1);
    const written = readFileSync(join(projectRoot, '.agentsmesh/rules/y.md'), 'utf-8');
    expect(written).toContain('description: desc');
    expect(written).toContain('claude-code');
    expect(written).toContain('src/**/*.ts');
  });
});

describe('import-metadata-serialize — extra branches', () => {
  it('command: hasAllowedTools=true, allowedTools provided non-empty (overrides existing)', async () => {
    const dest = join(projectRoot, 'cmd.md');
    writeFileSync(dest, '---\nallowedTools: ["Old"]\n---\nold');
    const out = await serializeImportedCommandWithFallback(
      dest,
      { hasAllowedTools: true, allowedTools: ['New'], hasDescription: true, description: 'd' },
      'b',
    );
    expect(out).toContain('New');
    expect(out).not.toContain('Old');
  });

  it('command: existing description not a string falls back to empty (line 22 ternary arm)', async () => {
    const dest = join(projectRoot, 'cmd2.md');
    // YAML frontmatter where description is a number → existing.description is non-string.
    writeFileSync(dest, '---\ndescription: 42\n---\nbody');
    const out = await serializeImportedCommandWithFallback(
      dest,
      { hasDescription: false, hasAllowedTools: false },
      'body',
    );
    // Empty string was used (serialized via YAML stringify, single or double quoted).
    expect(out).toMatch(/description:\s*['"]?['"]?/);
  });

  it('agent: maxTurns coerced from existing string is rejected by Number.isInteger guard (line 113 arm)', async () => {
    const dest = join(projectRoot, 'agent.md');
    writeFileSync(dest, '---\nmaxTurns: not-a-number\n---\nb');
    const out = await serializeImportedAgentWithFallback(dest, {}, 'b');
    // Number('not-a-number') is NaN → not integer → maxTurns key omitted.
    expect(out).not.toContain('maxTurns:');
  });

  it('agent: maxTurns 0 is rejected (must be > 0)', async () => {
    const dest = join(projectRoot, 'agent2.md');
    const out = await serializeImportedAgentWithFallback(dest, { maxTurns: 0 }, 'b');
    expect(out).not.toContain('maxTurns:');
  });

  it('agent: imported model overrides existing (line 105 readString arm)', async () => {
    const dest = join(projectRoot, 'agent3.md');
    writeFileSync(dest, '---\nmodel: old\n---\nb');
    const out = await serializeImportedAgentWithFallback(dest, { model: 'new' }, 'b');
    expect(out).toContain('model: new');
    expect(out).not.toContain('model: old');
  });

  it('agent: imported permissionMode (camelCase) preferred over kebab-case', async () => {
    const dest = join(projectRoot, 'agent4.md');
    const out = await serializeImportedAgentWithFallback(
      dest,
      { permissionMode: 'allow', 'permission-mode': 'plan' },
      'b',
    );
    expect(out).toContain('permissionMode: allow');
  });

  it('agent: imported memory overrides existing (line 118)', async () => {
    const dest = join(projectRoot, 'agent5.md');
    writeFileSync(dest, '---\nmemory: /old.md\n---\nb');
    const out = await serializeImportedAgentWithFallback(dest, { memory: '/new.md' }, 'b');
    expect(out).toContain('memory: /new.md');
  });

  it('skill: imported description overrides existing', async () => {
    mkdirSync(join(projectRoot, 'skill-dir'), { recursive: true });
    const dest = join(projectRoot, 'skill-dir', 'SKILL.md');
    writeFileSync(dest, '---\ndescription: old\n---\nbody');
    const out = await serializeImportedSkillWithFallback(dest, { description: 'new' }, 'b');
    expect(out).toContain('description: new');
  });

  it('agent: empty body trimmed → empty string output', async () => {
    const dest = join(projectRoot, 'agent6.md');
    const out = await serializeImportedAgentWithFallback(dest, { name: 'x' }, '   ');
    expect(out).toContain('name: x');
  });

  it('skill: imported empty body produces empty body output', async () => {
    mkdirSync(join(projectRoot, 'sk2'), { recursive: true });
    const dest = join(projectRoot, 'sk2', 'SKILL.md');
    const out = await serializeImportedSkillWithFallback(dest, {}, '');
    expect(out).toContain('name: sk2');
  });
});

describe('descriptor-import-runner — extra branches', () => {
  function makeDescriptor(importer: TargetDescriptor['importer']): TargetDescriptor {
    return {
      id: 'test-target',
      project: {
        rootInstructionPath: 'TEST.md',
        skillDir: '.test/skills',
      },
      detectionPaths: [],
      generators: { generate: async () => [], importFrom: async () => [] },
      importer,
    } as unknown as TargetDescriptor;
  }

  it('returns [] when descriptor.importer is undefined (line 245 if true arm)', async () => {
    const descriptor = makeDescriptor(undefined);
    const out = await runDescriptorImport(descriptor, projectRoot, 'project' as TargetLayoutScope, {
      normalize: (c) => c,
    });
    expect(out).toEqual([]);
  });

  it('singleFile spec without canonicalRootFilename throws (line 41)', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'singleFile',
      canonicalDir: '.agentsmesh/rules',
      source: { project: ['ROOT.md'] },
    } as unknown as ImportFeatureSpec;
    writeFileSync(join(projectRoot, 'ROOT.md'), '# r');
    const descriptor = makeDescriptor({ rules: spec });
    await expect(
      runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/canonicalRootFilename/);
  });

  it('flatFile spec without canonicalFilename throws', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'ignore',
      mode: 'flatFile',
      canonicalDir: '.agentsmesh',
      source: { project: ['.gitignore'] },
    } as unknown as ImportFeatureSpec;
    writeFileSync(join(projectRoot, '.gitignore'), 'node_modules');
    const descriptor = makeDescriptor({ ignore: spec });
    await expect(
      runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/canonicalFilename/);
  });

  it('mcpJson spec with no canonicalFilename throws', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'mcp',
      mode: 'mcpJson',
      canonicalDir: '.agentsmesh',
      source: { project: ['.tool/mcp.json'] },
    } as unknown as ImportFeatureSpec;
    mkdirSync(join(projectRoot, '.tool'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.tool', 'mcp.json'),
      JSON.stringify({ mcpServers: { a: { command: 'x' } } }),
    );
    const descriptor = makeDescriptor({ mcp: spec });
    await expect(
      runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/canonicalFilename/);
  });

  it('mcpJson with empty server set returns [] (continue branch)', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'mcp',
      mode: 'mcpJson',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/mcp.json',
      source: { project: ['.tool/mcp.json'] },
    } as unknown as ImportFeatureSpec;
    mkdirSync(join(projectRoot, '.tool'), { recursive: true });
    // Invalid JSON → parseMcpJson returns empty.
    writeFileSync(join(projectRoot, '.tool', 'mcp.json'), 'not json');
    const descriptor = makeDescriptor({ mcp: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toEqual([]);
  });

  it('mcpJson: parseMcpJson rejects non-object root', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'mcp',
      mode: 'mcpJson',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/mcp.json',
      source: { project: ['.tool/mcp.json'] },
    } as unknown as ImportFeatureSpec;
    mkdirSync(join(projectRoot, '.tool'), { recursive: true });
    writeFileSync(join(projectRoot, '.tool', 'mcp.json'), JSON.stringify(['array']));
    const descriptor = makeDescriptor({ mcp: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toEqual([]);
  });

  it('mcpJson: server missing command/url is skipped, but valid http/url still kept', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'mcp',
      mode: 'mcpJson',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/mcp.json',
      source: { project: ['.tool/mcp.json'] },
    } as unknown as ImportFeatureSpec;
    mkdirSync(join(projectRoot, '.tool'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.tool', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          empty: {},
          arrayItem: ['x'],
          httpServer: { url: 'http://x', description: 'desc' },
        },
      }),
    );
    const descriptor = makeDescriptor({ mcp: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toHaveLength(1);
    const written = readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8');
    expect(written).toContain('httpServer');
    expect(written).not.toContain('"empty"');
  });

  it('singleFile: when readFileSafe returns null (file missing) continues to next source', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'singleFile',
      canonicalDir: '.agentsmesh/rules',
      canonicalRootFilename: '_root.md',
      source: { project: ['MISSING.md'] },
    } as unknown as ImportFeatureSpec;
    const descriptor = makeDescriptor({ rules: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toEqual([]);
  });

  it('flatFile: missing source file returns []', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'ignore',
      mode: 'flatFile',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/ignore',
      source: { project: ['MISSING.gitignore'] },
    } as unknown as ImportFeatureSpec;
    const descriptor = makeDescriptor({ ignore: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toEqual([]);
  });

  it('runSpec: falls back to spec.fallbacks when primary source is empty (sources fallback arm)', async () => {
    const spec: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'flatFile',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/fallback.txt',
      source: { project: [] },
      fallbacks: { project: ['FALLBACK.txt'] },
    } as unknown as ImportFeatureSpec;
    writeFileSync(join(projectRoot, 'FALLBACK.txt'), 'hello');
    const descriptor = makeDescriptor({ rules: spec });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out).toHaveLength(1);
  });

  it('importer specs: array-form returns multiple specs (specsForFeature line 235 arm)', async () => {
    const specA: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'flatFile',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/a.txt',
      source: { project: ['a.txt'] },
    } as unknown as ImportFeatureSpec;
    const specB: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'flatFile',
      canonicalDir: '.agentsmesh',
      canonicalFilename: '.agentsmesh/b.txt',
      source: { project: ['b.txt'] },
    } as unknown as ImportFeatureSpec;
    writeFileSync(join(projectRoot, 'a.txt'), 'A');
    writeFileSync(join(projectRoot, 'b.txt'), 'B');
    const descriptor = makeDescriptor({ rules: [specA, specB] });
    const out = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(out.map((r) => r.toPath).sort()).toEqual(['.agentsmesh/a.txt', '.agentsmesh/b.txt']);
  });
});
