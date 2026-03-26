/**
 * Windsurf importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromWindsurf } from '../../../../src/targets/windsurf/importer.js';
import {
  WINDSURF_RULES_ROOT,
  WINDSURF_RULES_DIR,
  WINDSURF_IGNORE,
  CODEIUM_IGNORE,
  WINDSURF_HOOKS_FILE,
  WINDSURF_MCP_CONFIG_FILE,
  WINDSURF_MCP_EXAMPLE_FILE,
} from '../../../../src/targets/windsurf/constants.js';

const TEST_DIR = join(tmpdir(), 'am-windsurf-importer-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromWindsurf', () => {
  it('imports .windsurfrules into _root.md with root frontmatter', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_RULES_ROOT), '# Windsurf Rules\n- Use TDD\n');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.length).toBe(1);
    expect(results[0]!.fromTool).toBe('windsurf');
    expect(results[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Windsurf Rules');
    expect(content).toContain('- Use TDD');
  });

  it('imports .windsurf/rules/*.md into canonical rules', async () => {
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, 'typescript.md'),
      '---\ndescription: TS rules\nglobs: ["src/**/*.ts"]\n---\n\nUse strict TS.',
    );
    const results = await importFromWindsurf(TEST_DIR);
    const ruleResult = results.find((r) => r.toPath === '.agentsmesh/rules/typescript.md');
    expect(ruleResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict TS.');
  });

  it('imports .windsurf/rules/*.md with `glob` into canonical `globs`', async () => {
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, 'ui.md'),
      '---\ntrigger: glob\nglob: "src/components/**"\n---\n\nUI constraints.',
    );
    await importFromWindsurf(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'ui.md'), 'utf-8');
    expect(content).toContain('trigger: glob');
    expect(content).toContain('globs:');
    expect(content).toContain('src/components/**');
    expect(content).not.toContain('\nglob:');
  });

  it('imports .windsurfignore into .agentsmesh/ignore', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_IGNORE), 'node_modules/\ndist/\n.env\n');
    const results = await importFromWindsurf(TEST_DIR);
    const ignoreResult = results.find((r) => r.toPath === '.agentsmesh/ignore');
    expect(ignoreResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    expect(content).toContain('.env');
  });

  it('imports all sources when all exist', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_RULES_ROOT), 'Root rules');
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'foo.md'), '---\ndescription: Foo\n---\n\nFoo body');
    writeFileSync(join(TEST_DIR, WINDSURF_IGNORE), '*.log\n');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.length).toBe(3);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/foo.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(true);
  });

  it('handles empty .windsurfrules file (empty body)', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_RULES_ROOT), '');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
  });

  it('skips .windsurfignore when only comments and whitespace', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_IGNORE), '# comment\n  \n# another\n');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/ignore')).toBeUndefined();
  });

  it('imports .codeiumignore when .windsurfignore is absent', async () => {
    writeFileSync(join(TEST_DIR, CODEIUM_IGNORE), 'node_modules/\nbuild/\n');
    const results = await importFromWindsurf(TEST_DIR);
    const ignoreResult = results.find((r) => r.toPath === '.agentsmesh/ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromPath).toContain(CODEIUM_IGNORE);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('build/');
  });

  it('imports .windsurf/rules/_root.md as non-root when no .windsurfrules', async () => {
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, '_root.md'), '---\nroot: true\n---\n\nAlternate root.');
    const results = await importFromWindsurf(TEST_DIR);
    const rootResult = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');
    expect(rootResult).toBeDefined();
  });

  it('returns empty when no Windsurf config found', async () => {
    const results = await importFromWindsurf(TEST_DIR);
    expect(results).toEqual([]);
  });

  it('skips _root.md in .windsurf/rules when .windsurfrules provides root', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_RULES_ROOT), 'From windsurfrules');
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, '_root.md'), '---\nroot: true\n---\n\nFrom rules dir');
    const results = await importFromWindsurf(TEST_DIR);
    const rootContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootContent).toContain('From windsurfrules');
    expect(rootContent).not.toContain('From rules dir');
    expect(results.filter((r) => r.toPath === '.agentsmesh/rules/_root.md')).toHaveLength(1);
  });

  it('imports AGENTS.md as root rule when .windsurfrules is absent', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Windsurf via AGENTS.md\n');
    const results = await importFromWindsurf(TEST_DIR);
    const rootResult = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');
    expect(rootResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Windsurf via AGENTS.md');
  });

  it('normalizes codex-style skill directory links when importing AGENTS.md fallback', async () => {
    mkdirSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.agents',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    writeFileSync(
      join(TEST_DIR, 'AGENTS.md'),
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.\n',
    );

    await importFromWindsurf(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsmesh/skills/post-feature-qa/');
    expect(content).toContain(
      '.agentsmesh/skills/post-feature-qa/references/edge-case-checklist.md',
    );
    expect(content).not.toContain('.agents/skills/post-feature-qa/');
  });

  it('ignores AGENTS.md when .windsurfrules is present', async () => {
    writeFileSync(join(TEST_DIR, WINDSURF_RULES_ROOT), 'From windsurfrules');
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), 'From AGENTS.md');
    await importFromWindsurf(TEST_DIR);
    const rootContent = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(rootContent).toContain('From windsurfrules');
    expect(rootContent).not.toContain('From AGENTS.md');
  });

  it('imports trigger: model_decision from .windsurf/rules/*.md frontmatter', async () => {
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, 'ai-decide.md'),
      '---\ntrigger: model_decision\ndescription: AI decides\n---\n\nAI rule body.',
    );
    await importFromWindsurf(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'ai-decide.md'), 'utf-8');
    expect(content).toContain('trigger: model_decision');
    expect(content).toContain('AI decides');
  });

  it('imports trigger: manual from .windsurf/rules/*.md frontmatter', async () => {
    const rulesDir = join(TEST_DIR, WINDSURF_RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'manual-rule.md'), '---\ntrigger: manual\n---\n\nManual rule.');
    await importFromWindsurf(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'manual-rule.md'), 'utf-8');
    expect(content).toContain('trigger: manual');
  });

  it('imports .windsurf/hooks.json into canonical hooks.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify(
        {
          hooks: {
            pre_tool_use: [
              {
                command: 'echo pre',
                show_output: true,
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/hooks.yaml')).toBeDefined();
    const hooks = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooks).toContain('PreToolUse');
    expect(hooks).toContain('matcher: .*');
    expect(hooks).toContain('command: echo pre');
  });

  it('imports cursor-style legacy windsurf hooks format for backward compatibility', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_HOOKS_FILE),
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write',
                hooks: [{ type: 'command', command: 'echo post', timeout: 10 }],
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    await importFromWindsurf(TEST_DIR);
    const hooks = readFileSync(join(TEST_DIR, '.agentsmesh', 'hooks.yaml'), 'utf-8');
    expect(hooks).toContain('PostToolUse');
    expect(hooks).toContain('matcher: Write');
    expect(hooks).toContain('command: echo post');
    expect(hooks).toContain('timeout: 10');
  });

  it('imports .windsurf/mcp_config.example.json into canonical mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_EXAMPLE_FILE),
      JSON.stringify(
        {
          mcpServers: {
            context7: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@upstash/context7-mcp'],
            },
          },
        },
        null,
        2,
      ),
    );
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/mcp.json')).toBeDefined();
    const mcp = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    expect(mcp).toContain('"mcpServers"');
    expect(mcp).toContain('"context7"');
  });

  it('imports .windsurf/mcp_config.json when example file is absent', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, WINDSURF_MCP_CONFIG_FILE),
      JSON.stringify(
        {
          mcpServers: {
            local: { type: 'stdio', command: 'node', args: ['server.js'] },
          },
        },
        null,
        2,
      ),
    );
    const results = await importFromWindsurf(TEST_DIR);
    const mcpResult = results.find((r) => r.toPath === '.agentsmesh/mcp.json');
    expect(mcpResult).toBeDefined();
    expect(mcpResult?.fromPath).toContain('mcp_config.json');
  });
});

describe('importFromWindsurf — workflows', () => {
  it('imports .windsurf/workflows/*.md as canonical commands', async () => {
    const workflowsDir = join(TEST_DIR, '.windsurf', 'workflows');
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(
      join(workflowsDir, 'deploy.md'),
      '---\ndescription: Deploy workflow\n---\n\nRun deploy steps.',
    );
    const results = await importFromWindsurf(TEST_DIR);
    const cmdResult = results.find((r) => r.toPath === '.agentsmesh/commands/deploy.md');
    expect(cmdResult).toBeDefined();
    expect(cmdResult?.feature).toBe('commands');
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'deploy.md'), 'utf-8');
    expect(content).toContain('description: Deploy workflow');
    expect(content).toContain('Run deploy steps.');
  });

  it('imports multiple workflows', async () => {
    const workflowsDir = join(TEST_DIR, '.windsurf', 'workflows');
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, 'deploy.md'), '# Deploy\n');
    writeFileSync(join(workflowsDir, 'review.md'), '# Review\n');
    const results = await importFromWindsurf(TEST_DIR);
    const cmds = results.filter((r) => r.feature === 'commands');
    expect(cmds).toHaveLength(2);
    expect(cmds.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/commands/deploy.md',
      '.agentsmesh/commands/review.md',
    ]);
  });

  it('preserves existing canonical command metadata when importing body-only workflows', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'),
      '---\ndescription: Review workflow\nallowed-tools:\n  - Read\n  - Grep\n---\n\nOld review body.',
    );
    const workflowsDir = join(TEST_DIR, '.windsurf', 'workflows');
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, 'review.md'), 'New review body.\n');

    await importFromWindsurf(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review workflow');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('- Read');
    expect(content).toContain('- Grep');
    expect(content).toContain('New review body.');
    expect(content).not.toContain('Old review body.');
  });
});

describe('importFromWindsurf — skills', () => {
  it('imports .windsurf/skills/{name}/ directories as canonical skills', async () => {
    const skillDir = join(TEST_DIR, '.windsurf', 'skills', 'api-gen');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: API generation skill\n---\n\nWhen creating APIs, follow patterns.',
    );
    const results = await importFromWindsurf(TEST_DIR);
    const skillResult = results.find((r) => r.toPath === '.agentsmesh/skills/api-gen/SKILL.md');
    expect(skillResult).toBeDefined();
    expect(skillResult?.feature).toBe('skills');
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('description: API generation skill');
    expect(content).toContain('When creating APIs');
  });

  it('imports projected agent skills back into canonical agents', async () => {
    const skillDir = join(TEST_DIR, '.windsurf', 'skills', 'am-agent-reviewer');
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'skills', 'am-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'description: Review specialist',
        'x-agentsmesh-kind: agent',
        'x-agentsmesh-name: reviewer',
        'x-agentsmesh-tools:',
        '  - Read',
        '  - Grep',
        'x-agentsmesh-model: sonnet',
        'x-agentsmesh-permission-mode: ask',
        'x-agentsmesh-max-turns: 9',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.find((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBeDefined();
    expect(
      results.find((r) => r.toPath === '.agentsmesh/skills/am-agent-reviewer/SKILL.md'),
    ).toBeUndefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: Review specialist');
    expect(content).toContain('Review risky changes first.');
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'skills', 'am-agent-reviewer'))).toBe(false);
  });

  it('imports skill supporting files alongside SKILL.md', async () => {
    const skillDir = join(TEST_DIR, '.windsurf', 'skills', 'tdd');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# TDD Skill\n');
    writeFileSync(join(skillDir, 'example.ts'), 'const x = 1;');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/skills/tdd/SKILL.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/skills/tdd/example.ts')).toBe(true);
    const supportContent = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'skills', 'tdd', 'example.ts'),
      'utf-8',
    );
    expect(supportContent).toBe('const x = 1;');
  });

  it('skips skill directories without SKILL.md', async () => {
    const skillDir = join(TEST_DIR, '.windsurf', 'skills', 'empty-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'other.md'), 'Not a skill manifest.');
    const results = await importFromWindsurf(TEST_DIR);
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(0);
  });

  it('imports only intended scoped AGENTS.md files and skips hidden and fixture locations', async () => {
    writeFileSync(join(TEST_DIR, 'AGENTS.md'), '# Root Windsurf Rules\n');
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'AGENTS.md'), '# Src Rules\n');
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '.worktrees-security-collaboration.md'),
      'stale hidden rule',
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'tests-e2e-fixtures-windsurf-project.md'),
      'stale fixture rule',
    );
    mkdirSync(join(TEST_DIR, '.worktrees', 'security-collaboration'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.worktrees', 'security-collaboration', 'AGENTS.md'),
      '# Hidden Worktree Rules\n',
    );
    mkdirSync(join(TEST_DIR, 'tests', 'e2e', 'fixtures', 'windsurf-project'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'tests', 'e2e', 'fixtures', 'windsurf-project', 'AGENTS.md'),
      '# Fixture Rules\n',
    );

    const results = await importFromWindsurf(TEST_DIR);

    expect(
      results
        .filter((r) => r.feature === 'rules')
        .map((r) => r.toPath)
        .sort(),
    ).toEqual(['.agentsmesh/rules/_root.md', '.agentsmesh/rules/src.md']);
    expect(
      existsSync(join(TEST_DIR, '.agentsmesh', 'rules', '.worktrees-security-collaboration.md')),
    ).toBe(false);
    expect(
      existsSync(join(TEST_DIR, '.agentsmesh', 'rules', 'tests-e2e-fixtures-windsurf-project.md')),
    ).toBe(false);
  });
});
