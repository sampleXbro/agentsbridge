/**
 * Branch coverage for the defensive paths in the zed importers and linter.
 *
 * These are the "user handed us something odd" branches: frontmatter fields of the
 * wrong type, a malformed canonical YAML document, and a permission entry Zed's
 * tool table has no home for.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintPermissions } from '../../../../src/targets/zed/lint.js';
import { importFromZed } from '../../../../src/targets/zed/importer.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function tempRoot(): string {
  dir = mkdtempSync(join(tmpdir(), 'am-zed-branch-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  return dir;
}

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('zed lintPermissions — entries Zed has no tool for', () => {
  it('names each unmappable entry at global scope', () => {
    const diagnostics = lintPermissions(
      makeCanonical({ permissions: { allow: ['Read(./src/**)'], deny: [], ask: [] } }),
      { scope: 'global' },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('Read(./src/**)');
    expect(diagnostics[0]!.level).toBe('warning');
  });

  it('is silent at global scope when every entry maps to a Zed tool', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: ['Bash(ls)'], deny: [], ask: [] } }), {
        scope: 'global',
      }),
    ).toEqual([]);
  });
});

describe('zed rules import — frontmatter of the wrong type is dropped, not propagated', () => {
  it('ignores a non-string description and a non-array globs', async () => {
    const root = tempRoot();
    writeFileSync(
      join(root, '.rules'),
      ['---', 'description:', '  nested: true', 'globs: "not-a-list"', '---', '', '# Root'].join(
        '\n',
      ),
    );

    await importFromZed(root, { scope: 'project' });

    const canonical = readFileSync(join(root, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(canonical).toContain('root: true');
    expect(canonical).toContain('# Root');
    // Neither malformed value survives into canonical frontmatter.
    expect(canonical).not.toContain('nested: true');
    expect(canonical).not.toContain('not-a-list');
  });
});

describe('zed rules import — well-formed frontmatter is carried through', () => {
  it('keeps a string description; globs are dropped because a root rule always applies', async () => {
    const root = tempRoot();
    writeFileSync(
      join(root, '.rules'),
      ['---', 'description: Root rules', 'globs:', '  - "**/*.ts"', '---', '', '# Root'].join('\n'),
    );

    await importFromZed(root, { scope: 'project' });

    const canonical = readFileSync(join(root, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(canonical).toContain('root: true');
    expect(canonical).toContain('description: Root rules');
  });
});

describe('zed lint — settings-backed features on an unrewritable settings.json', () => {
  it('is silent when nothing would be written to settings.json', () => {
    expect(lintPermissions(makeCanonical(), { scope: 'global' })).toEqual([]);
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } }), {
        scope: 'global',
      }),
    ).toEqual([]);
  });
});

describe('zed settings import — a malformed canonical file starts a fresh document', () => {
  it('does not crash or propagate garbage when permissions.yaml is not valid YAML', async () => {
    const root = tempRoot();
    // Permissions are global-only for zed, so this exercises the global settings path.
    mkdirSync(join(root, '.config', 'zed'), { recursive: true });
    writeFileSync(
      join(root, '.config', 'zed', 'settings.json'),
      JSON.stringify({
        agent: {
          tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^ls$' }] } } },
        },
      }),
    );
    // Unparseable YAML: the importer must fall back to a fresh document.
    writeFileSync(join(root, '.agentsmesh', 'permissions.yaml'), 'allow: [unclosed\n\t: :\n');

    await importFromZed(root, { scope: 'global' });

    const yaml = readFileSync(join(root, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(yaml).toContain('ls');
    expect(yaml).not.toContain('unclosed');
  });

  it('preserves canonical ask and comments when merging imported permissions', async () => {
    const root = tempRoot();
    mkdirSync(join(root, '.config', 'zed'), { recursive: true });
    writeFileSync(
      join(root, '.config', 'zed', 'settings.json'),
      JSON.stringify({
        agent: {
          tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^ls$' }] } } },
        },
      }),
    );
    writeFileSync(
      join(root, '.agentsmesh', 'permissions.yaml'),
      '# hand-written\nallow: []\ndeny: []\nask:\n  - Bash(git push:*)\n',
    );

    await importFromZed(root, { scope: 'global' });

    const yaml = readFileSync(join(root, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(yaml).toContain('# hand-written');
    expect(yaml).toContain('Bash(git push:*)');
    expect(yaml).toContain('ls');
  });

  it('merges into a well-formed canonical file instead of replacing it', async () => {
    const root = tempRoot();
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(
      join(root, '.zed', 'settings.json'),
      JSON.stringify({ file_scan_exclusions: ['**/dist'] }),
    );
    writeFileSync(join(root, '.agentsmesh', 'ignore'), 'node_modules\n');

    await importFromZed(root, { scope: 'project' });

    const ignore = readFileSync(join(root, '.agentsmesh', 'ignore'), 'utf-8');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('dist');
  });
});
