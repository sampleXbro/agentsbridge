import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasGlobalCursorArtifacts,
  importGlobalCursorRulesFromDir,
  importGlobalUserRules,
  importGlobalDotCursorAgents,
  importGlobalMcp,
  importGlobalAgents,
  importGlobalCommands,
} from '../../../../src/targets/cursor/import-global-exports-helpers.js';
import {
  mapCursorAgentFile,
  mapCursorCommandFile,
  mapCursorRuleFile,
} from '../../../../src/targets/cursor/importer-mappers.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot: string;
const noopNorm = (c: string): string => c;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-cursor-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('hasGlobalCursorArtifacts — branch coverage', () => {
  it('returns false on completely empty project', async () => {
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(false);
  });

  it('returns true when .cursor/rules dir exists', async () => {
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(true);
  });

  it('returns true when AGENTS.md exists with content', async () => {
    writeFile('.cursor/AGENTS.md', '# data');
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(true);
  });

  it('returns false when only empty file exists', async () => {
    writeFile('.cursor/AGENTS.md', '   ');
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(false);
  });

  it('returns true when user-rules.md export exists', async () => {
    writeFile('.agentsmesh-exports/cursor/user-rules.md', '# data');
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(true);
  });

  it('returns true when .cursor/hooks.json file is present', async () => {
    writeFile('.cursor/hooks.json', '{}');
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(true);
  });

  it('returns true when .cursor/mcp.json file is present', async () => {
    writeFile('.cursor/mcp.json', '{}');
    expect(await hasGlobalCursorArtifacts(projectRoot)).toBe(true);
  });
});

describe('importGlobal* helpers — branches', () => {
  it('importGlobalUserRules returns false when file missing', async () => {
    const out: ImportResult[] = [];
    const ok = await importGlobalUserRules(projectRoot, out, noopNorm);
    expect(ok).toBe(false);
    expect(out).toEqual([]);
  });

  it('importGlobalUserRules returns false on empty file content', async () => {
    writeFile('.agentsmesh-exports/cursor/user-rules.md', '   ');
    const out: ImportResult[] = [];
    expect(await importGlobalUserRules(projectRoot, out, noopNorm)).toBe(false);
  });

  it('importGlobalDotCursorAgents returns false on empty content', async () => {
    writeFile('.cursor/AGENTS.md', '');
    const out: ImportResult[] = [];
    expect(await importGlobalDotCursorAgents(projectRoot, out, noopNorm)).toBe(false);
  });

  it('importGlobalMcp returns silently when file missing', async () => {
    const out: ImportResult[] = [];
    await importGlobalMcp(projectRoot, out);
    expect(out).toEqual([]);
  });

  it('importGlobalMcp skips invalid JSON', async () => {
    writeFile('.cursor/mcp.json', '{ broken');
    const out: ImportResult[] = [];
    await importGlobalMcp(projectRoot, out);
    expect(out).toEqual([]);
  });

  it('importGlobalMcp skips JSON without mcpServers key', async () => {
    writeFile('.cursor/mcp.json', '{"other":1}');
    const out: ImportResult[] = [];
    await importGlobalMcp(projectRoot, out);
    expect(out).toEqual([]);
  });

  it('importGlobalMcp writes canonical mcp.json when valid', async () => {
    writeFile('.cursor/mcp.json', JSON.stringify({ mcpServers: { x: { command: 'node' } } }));
    const out: ImportResult[] = [];
    await importGlobalMcp(projectRoot, out);
    expect(out).toHaveLength(1);
    expect(existsSync(join(projectRoot, '.agentsmesh/mcp.json'))).toBe(true);
  });

  it('importGlobalAgents/Commands handle missing dirs as no-op', async () => {
    const out: ImportResult[] = [];
    await importGlobalAgents(projectRoot, out, noopNorm);
    await importGlobalCommands(projectRoot, out, noopNorm);
    expect(out).toEqual([]);
  });

  it('importGlobalCursorRulesFromDir importing alwaysApply true marks rootWritten', async () => {
    writeFile('.cursor/rules/_root.mdc', '---\nalwaysApply: true\n---\nbody');
    const out: ImportResult[] = [];
    const rootWritten = await importGlobalCursorRulesFromDir(projectRoot, out, noopNorm);
    expect(rootWritten).toBe(true);
    expect(out).toHaveLength(1);
  });

  it('importGlobalCursorRulesFromDir skips a second alwaysApply true after root already written', async () => {
    writeFile('.cursor/rules/_root.mdc', '---\nalwaysApply: true\n---\nfirst');
    writeFile('.cursor/rules/another.mdc', '---\nalwaysApply: true\n---\nsecond');
    const out: ImportResult[] = [];
    const rootWritten = await importGlobalCursorRulesFromDir(projectRoot, out, noopNorm);
    expect(rootWritten).toBe(true);
    // Only the first root rule is imported; the second alwaysApply: true is dropped.
    expect(out).toHaveLength(1);
  });

  it('importGlobalCursorRulesFromDir keeps second non-root rule after root has been written', async () => {
    writeFile('.cursor/rules/_root.mdc', '---\nalwaysApply: true\n---\nfirst');
    writeFile('.cursor/rules/sub.mdc', '---\nalwaysApply: false\ndescription: D\n---\nbody');
    const out: ImportResult[] = [];
    const rootWritten = await importGlobalCursorRulesFromDir(projectRoot, out, noopNorm);
    expect(rootWritten).toBe(true);
    expect(out).toHaveLength(2);
  });
});

describe('importer-mappers — branch coverage', () => {
  it('mapCursorRuleFile derives trigger=glob when alwaysApply false + globs', async () => {
    let rootCalled = false;
    const mapping = await mapCursorRuleFile(
      'a.mdc',
      '/dest',
      () => '---\nalwaysApply: false\nglobs: ["src/**"]\n---\nbody',
      () => {
        rootCalled = true;
      },
    );
    expect(rootCalled).toBe(false);
    expect(mapping.content).toContain('trigger: glob');
  });

  it('mapCursorRuleFile derives trigger=model_decision when description present', async () => {
    const mapping = await mapCursorRuleFile(
      'b.mdc',
      '/dest',
      () => '---\nalwaysApply: false\ndescription: Hello\n---\nbody',
      () => {},
    );
    expect(mapping.content).toContain('trigger: model_decision');
  });

  it('mapCursorRuleFile derives trigger=manual when no globs and no description', async () => {
    const mapping = await mapCursorRuleFile(
      'c.mdc',
      '/dest',
      () => '---\nalwaysApply: false\n---\nbody',
      () => {},
    );
    expect(mapping.content).toContain('trigger: manual');
  });

  it('mapCursorRuleFile sets root true when alwaysApply true', async () => {
    let rootCalled = false;
    const mapping = await mapCursorRuleFile(
      'd.mdc',
      '/dest',
      () => '---\nalwaysApply: true\n---\nbody',
      () => {
        rootCalled = true;
      },
    );
    expect(rootCalled).toBe(true);
    expect(mapping.destPath).toContain('_root.md');
    expect(mapping.content).toContain('root: true');
  });

  it('mapCursorRuleFile sets trigger=null when alwaysApply absent', async () => {
    const mapping = await mapCursorRuleFile(
      'e.mdc',
      '/dest',
      () => '---\nrandom: yes\n---\nbody',
      () => {},
    );
    expect(mapping.content).not.toContain('trigger:');
  });

  it('mapCursorCommandFile uses kebab allowed-tools when camelCase absent', async () => {
    const mapping = await mapCursorCommandFile(
      'cmd.md',
      '/dest',
      () => '---\nallowed-tools: ["Read"]\n---\nbody',
    );
    expect(mapping.content).toContain('Read');
  });

  it('mapCursorCommandFile reads camelCase allowedTools when present', async () => {
    const mapping = await mapCursorCommandFile(
      'cmd.md',
      '/dest',
      () => '---\nallowedTools: ["Bash"]\n---\nbody',
    );
    expect(mapping.content).toContain('Bash');
  });

  it('mapCursorAgentFile produces canonical agent content', async () => {
    const mapping = await mapCursorAgentFile(
      'a.md',
      '/dest',
      () => '---\nname: my-a\ndescription: D\n---\nbody',
    );
    expect(mapping.content).toContain('name: my-a');
  });

  it('mapCursorRuleFile globs not array (defaults to [])', async () => {
    const mapping = await mapCursorRuleFile(
      'g.mdc',
      '/dest',
      () => '---\nalwaysApply: false\nglobs: "single"\n---\nbody',
      () => {},
    );
    // globs not an array → treated as empty, falls through to manual
    expect(mapping.content).toContain('trigger: manual');
  });
});
