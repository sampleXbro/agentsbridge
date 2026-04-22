import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCursor } from '../../../../src/targets/cursor/importer.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-import-cursor-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromCursor — rules', () => {
  it('imports AGENTS.md to .agentsmesh/rules/_root.md', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Project Rules\n\nUse TypeScript.');
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TypeScript.');
  });

  it('imports .cursor/rules/*.mdc to .agentsmesh/rules/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'typescript.mdc'),
      '---\nalwaysApply: false\ndescription: TS rules\nglobs: src/**/*.ts\n---\n\nUse strict mode.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      toPath: '.agentsmesh/rules/typescript.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict mode.');
    expect(content).not.toContain('alwaysApply');
    expect(content).toContain('root: false');
  });

  it('recursively imports nested .cursor/rules/**/*.mdc files preserving directories', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules', 'frontend'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'frontend', 'react.mdc'),
      '---\nalwaysApply: false\ndescription: React rules\n---\n\nUse server components carefully.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/rules/frontend/react.md',
      feature: 'rules',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'frontend', 'react.md'),
      'utf-8',
    );
    expect(content).toContain('description: React rules');
    expect(content).toContain('Use server components carefully.');
    expect(content).toContain('root: false');
  });

  it('converts alwaysApply: true to root: true', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', '_root.mdc'),
      '---\nalwaysApply: true\n---\n\nRoot content.',
    );
    const results = await importFromCursor(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(results[0]!.feature).toBe('rules');
  });

  it('returns empty when no Cursor config found', async () => {
    const results = await importFromCursor(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('adds root frontmatter to AGENTS.md when it has none', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), 'Plain content.');
    await importFromCursor(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toMatch(/---[\s\S]*?root:\s*true/);
  });
});

describe('importFromCursor — commands', () => {
  it('imports .cursor/commands/*.md to .agentsmesh/commands/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'commands', 'review.md'),
      '---\ndescription: Run code review\n---\n\nReview changes.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/commands/review.md',
      feature: 'commands',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Run code review');
    expect(content).toContain('Review changes.');
  });

  it('imports multiple command files', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'deploy.md'), '# Deploy\n');
    const results = await importFromCursor(TEST_DIR);
    const commandResults = results.filter((r) => r.feature === 'commands');
    expect(commandResults).toHaveLength(2);
    const paths = commandResults.map((r) => r.toPath).sort();
    expect(paths).toEqual(['.agentsmesh/commands/deploy.md', '.agentsmesh/commands/review.md']);
  });

  it('adds placeholder command frontmatter when Cursor command files have body only', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), 'Review changes.\n');

    await importFromCursor(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: ""');
    expect(content).toContain('allowed-tools: []');
    expect(content).toContain('Review changes.');
  });

  it('preserves existing canonical command metadata when importing body-only generated commands', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Code review\nallowed-tools:\n  - Read\n  - Grep\n---\n\nOld body.',
    );
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), 'New body from Cursor.\n');

    await importFromCursor(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Code review');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('- Read');
    expect(content).toContain('- Grep');
    expect(content).toContain('New body from Cursor.');
    expect(content).not.toContain('Old body.');
  });
});

describe('importFromCursor — agents', () => {
  it('imports .cursor/agents/*.md to .agentsmesh/agents/*.md', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'agents', 'code-reviewer.md'),
      '---\nname: code-reviewer\ndescription: Reviews code\ntools:\n  - Read\nmodel: sonnet\n---\n\nYou are an expert reviewer.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/agents/code-reviewer.md',
      feature: 'agents',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(content).toContain('name: code-reviewer');
    expect(content).toContain('You are an expert reviewer.');
  });

  it('adds placeholder agent frontmatter when Cursor agents have body only', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'agents'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'agents', 'reviewer.md'), 'Review risky changes.\n');

    await importFromCursor(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: ""');
    expect(content).toContain('tools: []');
    expect(content).toContain('Review risky changes.');
  });
});

describe('importFromCursor — skills (flat format)', () => {
  it('imports .cursor/skills/{name}.md to .agentsmesh/skills/{name}/SKILL.md', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'skills'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'api-gen.md'),
      '---\ndescription: Generate APIs\n---\n\nWhen creating APIs, check patterns.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/skills/api-gen/SKILL.md',
      feature: 'skills',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Generate APIs');
    expect(content).toContain('When creating APIs');
  });

  it('imports multiple flat skill files', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'skills'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'api-gen.md'), '# API\n');
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'tdd.md'), '# TDD\n');
    const results = await importFromCursor(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(2);
    const paths = skillResults.map((r) => r.toPath).sort();
    expect(paths).toEqual([
      '.agentsmesh/skills/api-gen/SKILL.md',
      '.agentsmesh/skills/tdd/SKILL.md',
    ]);
  });

  it('adds placeholder skill frontmatter when Cursor skills have body only', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'skills'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'qa.md'), 'Run QA.\n');

    await importFromCursor(TEST_DIR);

    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'qa', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('name: qa');
    expect(content).toContain('description: ""');
    expect(content).toContain('Run QA.');
  });
});

describe('importFromCursor — skills (directory format, generated by agentsmesh)', () => {
  it('imports .cursor/skills/{name}/SKILL.md to .agentsmesh/skills/{name}/SKILL.md', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'skills', 'post-feature-qa'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'post-feature-qa', 'SKILL.md'),
      '---\ndescription: QA checklist\n---\n\nRun the QA checklist.',
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/skills/post-feature-qa/SKILL.md',
      feature: 'skills',
    });
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'post-feature-qa', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('QA checklist');
  });

  it('imports SKILL.md plus supporting files preserving relative paths', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'skills', 'typescript-pro', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'typescript-pro', 'SKILL.md'),
      '---\ndescription: TS pro\n---\n\nAdvanced TypeScript.',
    );
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'typescript-pro', 'references', 'advanced-types.md'),
      '# Advanced Types\n',
    );
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'typescript-pro', 'references', 'patterns.md'),
      '# Patterns\n',
    );
    const results = await importFromCursor(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(3);
    const paths = skillResults.map((r) => r.toPath).sort();
    expect(paths).toEqual([
      '.agentsmesh/skills/typescript-pro/SKILL.md',
      '.agentsmesh/skills/typescript-pro/references/advanced-types.md',
      '.agentsmesh/skills/typescript-pro/references/patterns.md',
    ]);
    const skillMd = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'typescript-pro', 'SKILL.md'),
      'utf-8',
    );
    expect(skillMd).toContain('Advanced TypeScript.');
    const refMd = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'typescript-pro', 'references', 'advanced-types.md'),
      'utf-8',
    );
    expect(refMd).toContain('# Advanced Types');
  });

  it('imports multiple directory-structured skills', async () => {
    for (const name of ['post-feature-qa', 'typescript-pro']) {
      mkdirSync(join(TEST_DIR, '.cursor', 'skills', name), { recursive: true });
      writeFileSync(join(TEST_DIR, '.cursor', 'skills', name, 'SKILL.md'), `# ${name}\n`);
    }
    const results = await importFromCursor(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults).toHaveLength(2);
    const paths = skillResults.map((r) => r.toPath).sort();
    expect(paths).toEqual([
      '.agentsmesh/skills/post-feature-qa/SKILL.md',
      '.agentsmesh/skills/typescript-pro/SKILL.md',
    ]);
  });
});

describe('importFromCursor — mcp.json', () => {
  it('imports .cursor/mcp.json to .agentsmesh/mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {},
          },
        },
      }),
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/mcp.json',
      feature: 'mcp',
    });
    const mcp = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(mcp.mcpServers.context7).toBeDefined();
  });

  it('skips mcp.json when malformed JSON', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'mcp.json'), 'NOT JSON');
    const results = await importFromCursor(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
  });

  it('skips mcp.json when no mcpServers key', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'mcp.json'), JSON.stringify({ other: {} }));
    const results = await importFromCursor(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
  });
});

describe('importFromCursor — settings.json decomposition', () => {
  it('imports permissions to .agentsmesh/permissions.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Read', 'Grep'], deny: ['WebFetch'] } }),
    );
    const results = await importFromCursor(TEST_DIR);
    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult?.toPath).toBe('.agentsmesh/permissions.yaml');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8');
    expect(content).toContain('Read');
    expect(content).toContain('WebFetch');
  });

  it('imports hooks to .agentsmesh/hooks.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'prettier --write $FILE_PATH' }],
            },
          ],
        },
      }),
    );
    const results = await importFromCursor(TEST_DIR);
    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(content).toContain('PostToolUse');
    expect(content).toContain('prettier');
  });

  it('skips settings.json when malformed', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'settings.json'), 'BAD JSON');
    const results = await importFromCursor(TEST_DIR);
    expect(results.filter((r) => r.feature === 'permissions')).toHaveLength(0);
    expect(results.filter((r) => r.feature === 'hooks')).toHaveLength(0);
  });

  it('skips permissions when allow and deny are empty', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'settings.json'),
      JSON.stringify({ permissions: { allow: [], deny: [] } }),
    );
    const results = await importFromCursor(TEST_DIR);
    expect(results.filter((r) => r.feature === 'permissions')).toHaveLength(0);
  });
});

describe('importFromCursor — .cursorignore', () => {
  it('imports .cursorignore to .agentsmesh/ignore', async () => {
    writeFileSync(join(TEST_DIR, '.cursorignore'), 'node_modules\ndist\n.env\n');
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      toPath: '.agentsmesh/ignore',
      feature: 'ignore',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('dist');
  });
});

describe('importFromCursor — .cursorrules fallback', () => {
  it('imports .cursorrules as root rule when AGENTS.md is absent', async () => {
    writeFileSync(join(TEST_DIR, '.cursorrules'), '# Legacy Cursor Rules\n- Use TDD\n');
    const results = await importFromCursor(TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fromTool: 'cursor',
      fromPath: expect.stringContaining('.cursorrules'),
      toPath: '.agentsmesh/rules/_root.md',
      feature: 'rules',
    });
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Legacy Cursor Rules');
  });

  it('ignores .cursorrules when AGENTS.md is present', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# New Root\n');
    writeFileSync(join(TEST_DIR, '.cursorrules'), '# Old Rules\n');
    await importFromCursor(TEST_DIR);
    const rootContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootContent).toContain('# New Root');
    expect(rootContent).not.toContain('# Old Rules');
  });

  it('ignores .cursorrules when .cursor/rules/ has an alwaysApply:true rule', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', '_root.mdc'),
      '---\nalwaysApply: true\n---\n\n# MDC Root\n',
    );
    writeFileSync(join(TEST_DIR, '.cursorrules'), '# Old Rules\n');
    await importFromCursor(TEST_DIR);
    const rootContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootContent).toContain('# MDC Root');
    expect(rootContent).not.toContain('# Old Rules');
  });
});

describe('importFromCursor — full fidelity', () => {
  it('imports all Cursor config in a single call', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Root\n');
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'ts.mdc'),
      '---\nalwaysApply: false\n---\n\n# TS\n',
    );
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), '# Review\n');
    mkdirSync(join(TEST_DIR, '.cursor', 'agents'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'agents', 'reviewer.md'), '# Reviewer\n');
    mkdirSync(join(TEST_DIR, '.cursor', 'skills'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'api-gen.md'), '# API gen\n');
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { ctx: { type: 'stdio', command: 'npx', args: [], env: {} } } }),
    );
    writeFileSync(
      join(TEST_DIR, '.cursor', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Read'], deny: [] } }),
    );
    writeFileSync(join(TEST_DIR, '.cursorignore'), 'dist\n');

    const results = await importFromCursor(TEST_DIR);
    const features = [...new Set(results.map((r) => r.feature))].sort();
    expect(features).toEqual(
      ['agents', 'commands', 'ignore', 'mcp', 'permissions', 'rules', 'skills'].sort(),
    );
  });
});

describe('importFromCursor — global exports', () => {
  it('returns empty when no global Cursor artifacts exist under home', async () => {
    expect(await importFromCursor(TEST_DIR, { scope: 'global' })).toEqual([]);
  });

  it('imports Cursor global exports and ~/.cursor tooling into canonical .agentsmesh/', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh-exports', 'cursor'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.cursor', 'skills', 'demo'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.agentsmesh-exports', 'cursor', 'user-rules.md'), '# U\n');
    writeFileSync(
      join(TEST_DIR, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { a: { command: 'npx', args: [] } } }),
    );
    writeFileSync(
      join(TEST_DIR, '.cursor', 'skills', 'demo', 'SKILL.md'),
      '---\nname: demo\ndescription: D\n---\nHi',
    );

    const results = await importFromCursor(TEST_DIR, { scope: 'global' });
    expect(results.map((r) => r.feature).sort()).toEqual(['mcp', 'rules', 'skills'].sort());
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf8')).toContain(
      '# U',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf8')).toContain('mcpServers');
    expect(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'skills', 'demo', 'SKILL.md'), 'utf8'),
    ).toContain('Hi');
  });

  it('splits embedded additional rules from ~/.cursor/AGENTS.md aggregate fallback', async () => {
    mkdirSync(join(TEST_DIR, '.cursor'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'AGENTS.md'),
      [
        '# Root',
        '',
        '<!-- agentsmesh:embedded-rules:start -->',
        '<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md","description":"TS rules","globs":["src/**/*.ts"],"targets":["cursor"]} -->',
        '## TS rules',
        'Use strict TS.',
        '<!-- agentsmesh:embedded-rule:end -->',
        '<!-- agentsmesh:embedded-rules:end -->',
      ].join('\n'),
    );

    const results = await importFromCursor(TEST_DIR, { scope: 'global' });

    expect(results.map((r) => r.toPath).sort()).toEqual(
      ['.agentsmesh/rules/_root.md', '.agentsmesh/rules/typescript.md'].sort(),
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf8')).toContain(
      '# Root',
    );
    const tsRule = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf8');
    expect(tsRule).toContain('description: TS rules');
    expect(tsRule).toContain('src/**/*.ts');
    expect(tsRule).toContain('Use strict TS.');
    expect(tsRule).not.toContain('<!-- agentsmesh:embedded-rules:start -->');
  });
});
