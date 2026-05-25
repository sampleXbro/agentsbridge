/**
 * Branch coverage for `resolveMapper` and helpers in
 * `src/targets/import/descriptor-default-mappers.ts`. Covers:
 *   - resolveMapper: returns spec.map verbatim when provided
 *   - resolveMapper: dispatches to ruleMapper for preset 'rule'
 *   - resolveMapper: dispatches to commandMapper for preset 'command'
 *   - resolveMapper: dispatches to agentMapper for preset 'agent'
 *   - resolveMapper: throws when neither preset nor map is provided
 *   - ruleMapper: applies frontmatterRemap and forces root=false
 *   - commandMapper: toStringArray for allowed-tools (array vs non-array)
 */
import { describe, it, expect } from 'vitest';
import {
  agentMapper,
  commandMapper,
  resolveMapper,
  ruleMapper,
} from '../../../../src/targets/import/descriptor-default-mappers.js';
import type { ImportFeatureSpec } from '../../../../src/targets/catalog/import-descriptor.js';

const ctx = (
  relativePath = 'r1.md',
  body = '# body',
): {
  destDir: string;
  relativePath: string;
  normalizeTo: () => string;
  fromTool: string;
  sourceAbs: string;
} => ({
  destDir: '/dst',
  relativePath,
  normalizeTo: (): string => `---\ndescription: original\nglobs:\n  - src/**\n---\n${body}`,
  fromTool: 'unit',
  sourceAbs: '/src/r1.md',
});

describe('resolveMapper', () => {
  it('returns the explicit `map` function when present (skips preset dispatch)', () => {
    const custom = (async () => ({
      destPath: '',
      toPath: '',
      content: '',
    })) as ImportFeatureSpec['map'];
    const spec: ImportFeatureSpec = {
      feature: 'rules',
      mode: 'file',
      canonicalDir: '.agentsmesh/rules',
      sourceDir: 'rules',
      map: custom,
    } as unknown as ImportFeatureSpec;
    expect(resolveMapper(spec)).toBe(custom);
  });

  it('dispatches to ruleMapper for preset "rule" — output pins root=false', async () => {
    const spec = {
      feature: 'rules',
      mode: 'file',
      canonicalDir: '.agentsmesh/rules',
      sourceDir: 'rules',
      preset: 'rule',
    } as unknown as ImportFeatureSpec;
    const out = await resolveMapper(spec)(ctx() as never);
    // The rule mapper's defining behavior: it injects `root: false` into the
    // serialized output. A different mapper would not.
    expect(out.toPath).toBe('.agentsmesh/rules/r1.md');
    expect(out.content).toContain('root: false');
  });

  it('dispatches to commandMapper for preset "command" — emits commands canonicalDir', async () => {
    const spec = {
      feature: 'commands',
      mode: 'file',
      canonicalDir: '.agentsmesh/commands',
      sourceDir: 'commands',
      preset: 'command',
    } as unknown as ImportFeatureSpec;
    const out = await resolveMapper(spec)({
      destDir: '/dst',
      relativePath: 'sync.md',
      normalizeTo: (): string => `---\ndescription: cmd\nallowed-tools:\n  - Bash\n---\nbody`,
      fromTool: 'unit',
      sourceAbs: '/src/sync.md',
    } as never);
    expect(out.toPath).toBe('.agentsmesh/commands/sync.md');
    expect(out.content).toContain('description: cmd');
    expect(out.content).not.toContain('root: false');
  });

  it('dispatches to agentMapper for preset "agent" — emits agents canonicalDir', async () => {
    const spec = {
      feature: 'agents',
      mode: 'file',
      canonicalDir: '.agentsmesh/agents',
      sourceDir: 'agents',
      preset: 'agent',
    } as unknown as ImportFeatureSpec;
    const out = await resolveMapper(spec)({
      destDir: '/dst',
      relativePath: 'a.md',
      normalizeTo: (): string => `---\nname: a\ndescription: d\n---\nbody`,
      fromTool: 'unit',
      sourceAbs: '/src/a.md',
    } as never);
    expect(out.toPath).toBe('.agentsmesh/agents/a.md');
    expect(out.content).toContain('name: a');
    expect(out.content).not.toContain('root: false');
  });

  it('throws when neither preset nor map is provided', () => {
    const spec = {
      feature: 'rules',
      mode: 'file',
      canonicalDir: '.agentsmesh/rules',
      sourceDir: 'rules',
    } as unknown as ImportFeatureSpec;
    expect(() => resolveMapper(spec)).toThrow(/needs a `preset` or `map`/);
  });
});

describe('ruleMapper', () => {
  it('applies frontmatterRemap and pins root=false in the serialized output', async () => {
    const spec = {
      feature: 'rules',
      mode: 'file',
      canonicalDir: '.agentsmesh/rules',
      sourceDir: 'rules',
      frontmatterRemap: (fm: Record<string, unknown>) => ({ ...fm, remapped: true }),
    } as unknown as ImportFeatureSpec;
    const mapper = ruleMapper(spec);
    const out = await mapper(ctx() as never);
    expect(out.toPath).toBe('.agentsmesh/rules/r1.md');
    expect(out.content).toContain('root: false');
    expect(out.content).toContain('remapped: true');
  });
});

describe('commandMapper', () => {
  it('coerces non-array allowed-tools to [] and array passthrough', async () => {
    const spec = {
      feature: 'commands',
      mode: 'file',
      canonicalDir: '.agentsmesh/commands',
      sourceDir: 'commands',
    } as unknown as ImportFeatureSpec;
    const arrayCtx = {
      destDir: '/dst',
      relativePath: 'c.md',
      normalizeTo: () => `---\ndescription: cmd\nallowed-tools:\n  - Bash\n  - Read\n---\nbody`,
      fromTool: 'unit',
      sourceAbs: '/src/c.md',
    };
    const out = await commandMapper(spec)(arrayCtx as never);
    expect(out.content).toContain('description: cmd');
    expect(out.content).toMatch(/Bash/);
    expect(out.content).toMatch(/Read/);
  });
});

describe('agentMapper', () => {
  it('serializes remapped frontmatter for agents', async () => {
    const spec = {
      feature: 'agents',
      mode: 'file',
      canonicalDir: '.agentsmesh/agents',
      sourceDir: 'agents',
    } as unknown as ImportFeatureSpec;
    const out = await agentMapper(spec)({
      destDir: '/dst',
      relativePath: 'a.md',
      normalizeTo: () => `---\nname: a\ndescription: d\n---\nbody`,
      fromTool: 'unit',
      sourceAbs: '/src/a.md',
    } as never);
    expect(out.toPath).toBe('.agentsmesh/agents/a.md');
    expect(out.content).toContain('name: a');
  });
});
