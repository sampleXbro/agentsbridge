import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { importFromCodebuff } from '../../../../src/targets/codebuff/importer.js';

let root = '';

function write(rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf-8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-codebuff-import-'));
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  root = '';
});

describe('importFromCodebuff (codebuff)', () => {
  it('returns an empty array for a project with no codebuff config', async () => {
    expect(await importFromCodebuff(root)).toEqual([]);
    expect(await importFromCodebuff(root, { scope: 'project' })).toEqual([]);
    expect(await importFromCodebuff(root, { scope: 'global' })).toEqual([]);
  });

  it('imports the root knowledge file as the canonical root rule', async () => {
    write('AGENTS.md', '# Standards\n\n- TypeScript strict');

    const results = await importFromCodebuff(root);

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    const canonical = read('.agentsmesh/rules/_root.md');
    expect(canonical).toContain('root: true');
    expect(canonical).toContain('- TypeScript strict');
  });

  it('imports nested knowledge files as scoped rules with a directory glob', async () => {
    write('AGENTS.md', '# Root');
    write('src/AGENTS.md', '# TypeScript\n\n- No any');

    const results = await importFromCodebuff(root);

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/src.md',
    ]);
    const canonical = read('.agentsmesh/rules/src.md');
    expect(canonical).toContain('globs:\n  - src/**');
    expect(canonical).toContain('root: false');
    expect(canonical).toContain('- No any');
  });

  it('flattens deep directories into one canonical slug', async () => {
    write('packages/core/AGENTS.md', '# Core');

    await importFromCodebuff(root);

    expect(read('.agentsmesh/rules/packages-core.md')).toContain('- packages/core/**');
  });

  it('never treats a file that merely ends in AGENTS.md as a knowledge file', async () => {
    write('docs/LEGACY_AGENTS.md', '# Historical notes');

    expect(await importFromCodebuff(root)).toEqual([]);
    expect(existsSync(join(root, '.agentsmesh/rules/docs.md'))).toBe(false);
  });

  it('never imports a dependency AGENTS.md out of node_modules', async () => {
    write('AGENTS.md', '# Root');
    write('node_modules/some-pkg/AGENTS.md', '# Vendor rules');
    write('packages/app/node_modules/nested-pkg/AGENTS.md', '# Vendor rules');

    const results = await importFromCodebuff(root);

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(existsSync(join(root, '.agentsmesh/rules/node_modules-some-pkg.md'))).toBe(false);
    expect(
      existsSync(join(root, '.agentsmesh/rules/packages-app-node_modules-nested-pkg.md')),
    ).toBe(false);
  });

  it('never treats another tool dot-directory as a scoped rule', async () => {
    write('.claude/AGENTS.md', '# Not ours');

    expect(await importFromCodebuff(root)).toEqual([]);
    expect(existsSync(join(root, '.agentsmesh/rules'))).toBe(false);
  });

  it('splits an embedded-rules block instead of copying it into the root rule', async () => {
    write(
      'AGENTS.md',
      [
        '# Root body',
        '',
        '<!-- agentsmesh:embedded-rules:start -->',
        '<!-- agentsmesh:embedded-rule:start {"source":"rules/style.md","description":"Style","globs":["src/**"],"targets":[]} -->',
        '## Style',
        '',
        'Be terse.',
        '<!-- agentsmesh:embedded-rule:end -->',
        '<!-- agentsmesh:embedded-rules:end -->',
      ].join('\n'),
    );

    await importFromCodebuff(root);

    const rootRule = read('.agentsmesh/rules/_root.md');
    expect(rootRule).toContain('# Root body');
    expect(rootRule).not.toContain('agentsmesh:embedded-rules:start');
    expect(read('.agentsmesh/rules/style.md')).toContain('Be terse.');
  });

  it('imports skills, projected commands, mcp servers and the ignore file', async () => {
    write('.agents/skills/api-generator/SKILL.md', '---\nname: api-generator\n---\n\n# API');
    write('.agents/skills/api-generator/references/check.md', '- check');
    write(
      '.agents/skills/am-command-review/SKILL.md',
      '---\nname: am-command-review\nx-agentsmesh-kind: command\nx-agentsmesh-name: review\n---\n\nReview it.',
    );
    write('.agents/mcp.json', JSON.stringify({ mcpServers: { github: { command: 'npx' } } }));
    write('.codebuffignore', 'dist/\n*.log\n');

    const results = await importFromCodebuff(root);

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/commands/review.md',
      '.agentsmesh/ignore',
      '.agentsmesh/mcp.json',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/check.md',
    ]);
    expect(JSON.parse(read('.agentsmesh/mcp.json')).mcpServers.github.command).toBe('npx');
    expect(read('.agentsmesh/ignore')).toBe('dist/\n*.log');
  });

  it('reads the home knowledge dotfile in global scope', async () => {
    write('.AGENTS.md', '# Personal rules');
    write('AGENTS.md', '# Project rules');

    const results = await importFromCodebuff(root, { scope: 'global' });

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(read('.agentsmesh/rules/_root.md')).toContain('# Personal rules');
  });

  it('does not import nested or ignore files in global scope', async () => {
    write('.AGENTS.md', '# Personal rules');
    write('src/AGENTS.md', '# Scoped');
    write('.codebuffignore', 'dist/');

    const results = await importFromCodebuff(root, { scope: 'global' });

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(existsSync(join(root, '.agentsmesh/ignore'))).toBe(false);
  });
});
