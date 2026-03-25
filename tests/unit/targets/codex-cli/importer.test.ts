/**
 * Codex importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCodex } from '../../../../src/targets/codex-cli/importer.js';
import {
  CODEX_MD,
  AGENTS_MD,
  CODEX_SKILLS_DIR,
  CODEX_CONFIG_TOML,
  CODEX_AGENTS_DIR,
} from '../../../../src/targets/codex-cli/constants.js';

const TEST_DIR = join(tmpdir(), 'ab-codex-importer-test');
const CODEX_SKILLS_FALLBACK_DIR = '.codex/skills';

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('importFromCodex: rules', () => {
  it('imports codex.md into _root.md with root frontmatter', async () => {
    writeFileSync(join(TEST_DIR, CODEX_MD), '# Rules\n- Use TypeScript\n');
    const results = await importFromCodex(TEST_DIR);
    const rulesResult = results.find((r) => r.feature === 'rules');
    expect(rulesResult).toBeDefined();
    expect(rulesResult!.fromTool).toBe('codex-cli');
    expect(rulesResult!.toPath).toBe('.agentsbridge/rules/_root.md');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Rules');
    expect(content).toContain('- Use TypeScript');
  });

  it('imports AGENTS.md when codex.md missing', async () => {
    writeFileSync(join(TEST_DIR, AGENTS_MD), '# Agents rules\n');
    const results = await importFromCodex(TEST_DIR);
    const rulesResult = results.find((r) => r.feature === 'rules');
    expect(rulesResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('# Agents rules');
  });

  it('normalizes windsurf-style skill directory links when importing AGENTS.md', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.windsurf', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.windsurf',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    writeFileSync(
      join(TEST_DIR, AGENTS_MD),
      'Use `.windsurf/skills/post-feature-qa/` and `.windsurf/skills/post-feature-qa/references/edge-case-checklist.md`.\n',
    );

    await importFromCodex(TEST_DIR);

    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('.agentsbridge/skills/post-feature-qa/');
    expect(content).toContain(
      '.agentsbridge/skills/post-feature-qa/references/edge-case-checklist.md',
    );
    expect(content).not.toContain('.windsurf/skills/post-feature-qa/');
  });

  it('prefers AGENTS.md over codex.md when both exist (official Codex path)', async () => {
    writeFileSync(join(TEST_DIR, CODEX_MD), '# From codex\n');
    writeFileSync(join(TEST_DIR, AGENTS_MD), '# From agents\n');
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'rules')).toHaveLength(1);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('# From agents');
    expect(content).not.toContain('# From codex');
  });

  it('returns empty when neither codex.md nor AGENTS.md exist', async () => {
    const results = await importFromCodex(TEST_DIR);
    expect(results).toEqual([]);
  });
});

describe('importFromCodex: skills', () => {
  it('imports SKILL.md from .agents/skills/{name}/', async () => {
    const skillDir = join(TEST_DIR, CODEX_SKILLS_DIR, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: A useful skill\n---\nDo the thing.',
    );
    const results = await importFromCodex(TEST_DIR);
    const skillResult = results.find((r) => r.feature === 'skills');
    expect(skillResult).toBeDefined();
    expect(skillResult!.fromTool).toBe('codex-cli');
    expect(skillResult!.toPath).toBe('.agentsbridge/skills/my-skill/SKILL.md');
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'my-skill', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('Do the thing.');
    expect(content).toContain('description: A useful skill');
  });

  it('imports supporting files alongside SKILL.md', async () => {
    const skillDir = join(TEST_DIR, CODEX_SKILLS_DIR, 'qa');
    const refsDir = join(skillDir, 'references');
    mkdirSync(refsDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'QA skill.');
    writeFileSync(join(refsDir, 'checklist.md'), '# Checklist');
    const results = await importFromCodex(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(2);
    expect(skillResults.some((r) => r.toPath.endsWith('checklist.md'))).toBe(true);
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'qa', 'references', 'checklist.md'),
      'utf-8',
    );
    expect(content).toContain('# Checklist');
  });

  it('imports multiple skills', async () => {
    for (const name of ['skill-a', 'skill-b']) {
      const skillDir = join(TEST_DIR, CODEX_SKILLS_DIR, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), `# ${name}`);
    }
    const results = await importFromCodex(TEST_DIR);
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores directories without SKILL.md', async () => {
    const emptyDir = join(TEST_DIR, CODEX_SKILLS_DIR, 'no-skill');
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'README.md'), '# Just docs');
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(0);
  });

  it('returns no skill results when skills dir absent', async () => {
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(0);
  });

  it('falls back to .codex/skills when .agents/skills is absent', async () => {
    const skillDir = join(TEST_DIR, CODEX_SKILLS_FALLBACK_DIR, 'fallback-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# Fallback skill');

    const results = await importFromCodex(TEST_DIR);

    expect(
      results.find((r) => r.toPath === '.agentsbridge/skills/fallback-skill/SKILL.md'),
    ).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'fallback-skill', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('# Fallback skill');
  });

  it('imports symlinked skills from .codex/skills fallback', async () => {
    const sourceDir = join(TEST_DIR, 'source-skill');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'SKILL.md'), '# Symlinked skill');
    writeFileSync(join(sourceDir, 'README.md'), 'linked docs');

    const fallbackDir = join(TEST_DIR, CODEX_SKILLS_FALLBACK_DIR);
    mkdirSync(fallbackDir, { recursive: true });
    symlinkSync(sourceDir, join(fallbackDir, 'linked-skill'), 'dir');

    const results = await importFromCodex(TEST_DIR);

    expect(
      results.find((r) => r.toPath === '.agentsbridge/skills/linked-skill/SKILL.md'),
    ).toBeDefined();
    expect(
      results.find((r) => r.toPath === '.agentsbridge/skills/linked-skill/README.md'),
    ).toBeDefined();
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'skills', 'linked-skill', 'SKILL.md'),
      'utf-8',
    );
    expect(content).toContain('# Symlinked skill');
  });

  it('imports metadata-tagged command skills back into canonical commands', async () => {
    const skillDir = join(TEST_DIR, CODEX_SKILLS_DIR, 'ab-command-review');
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(TEST_DIR, '.agentsbridge', 'skills', 'ab-command-review'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'description: Review changes',
        'x-agentsbridge-kind: command',
        'x-agentsbridge-name: review',
        'x-agentsbridge-allowed-tools:',
        '  - Read',
        '  - Bash(git diff)',
        '---',
        '',
        'Review the current diff for risk.',
      ].join('\n'),
    );

    const results = await importFromCodex(TEST_DIR);

    const commandResult = results.find((r) => r.feature === 'commands');
    expect(commandResult).toBeDefined();
    expect(commandResult?.toPath).toBe('.agentsbridge/commands/review.md');
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(0);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('description: Review changes');
    expect(content).toContain('allowed-tools:');
    expect(content).toContain('Bash(git diff)');
    expect(content).toContain('Review the current diff for risk.');
    expect(existsSync(join(TEST_DIR, '.agentsbridge', 'skills', 'ab-command-review'))).toBe(false);
  });

  it('imports metadata-tagged agent skills back into canonical agents', async () => {
    const skillDir = join(TEST_DIR, CODEX_SKILLS_DIR, 'ab-agent-reviewer');
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(TEST_DIR, '.agentsbridge', 'skills', 'ab-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'description: Review specialist',
        'x-agentsbridge-kind: agent',
        'x-agentsbridge-name: reviewer',
        'x-agentsbridge-tools:',
        '  - Read',
        '  - Grep',
        'x-agentsbridge-model: gpt-5-codex',
        'x-agentsbridge-permission-mode: ask',
        'x-agentsbridge-max-turns: 9',
        '---',
        '',
        'Review risky changes first.',
      ].join('\n'),
    );

    const results = await importFromCodex(TEST_DIR);

    expect(results.find((r) => r.feature === 'agents')).toBeDefined();
    expect(results.find((r) => r.toPath === '.agentsbridge/agents/reviewer.md')).toBeDefined();
    expect(results.filter((r) => r.feature === 'skills')).toHaveLength(0);
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'agents', 'reviewer.md'), 'utf-8');
    expect(content).toContain('name: reviewer');
    expect(content).toContain('model: gpt-5-codex');
    expect(content).toContain('Review risky changes first.');
    expect(existsSync(join(TEST_DIR, '.agentsbridge', 'skills', 'ab-agent-reviewer'))).toBe(false);
  });

  it('imports .codex/agents/*.toml into .agentsbridge/agents/*.md', async () => {
    writeFileSync(join(TEST_DIR, AGENTS_MD), '# Root\n');
    mkdirSync(join(TEST_DIR, '.codex', 'agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, CODEX_AGENTS_DIR, 'pr-explorer.toml'),
      [
        'name = "pr-explorer"',
        'description = "Explore PRs and summarize changes"',
        'model = "gpt-5.3-codex-spark"',
        'sandbox_mode = "read-only"',
        '',
        'developer_instructions = """',
        'Focus on risk and test coverage.',
        '"""',
      ].join('\n'),
    );

    const results = await importFromCodex(TEST_DIR);

    const agentResult = results.find((r) => r.toPath === '.agentsbridge/agents/pr-explorer.md');
    expect(agentResult).toBeDefined();
    expect(agentResult!.fromPath).toContain('.codex/agents/pr-explorer.toml');
    const content = readFileSync(
      join(TEST_DIR, '.agentsbridge', 'agents', 'pr-explorer.md'),
      'utf-8',
    );
    expect(content).toContain('name: pr-explorer');
    expect(content).toContain('description: Explore PRs');
    expect(content).toContain('model: gpt-5.3-codex-spark');
    expect(content).toContain('permissionMode: read-only');
    expect(content).toContain('Focus on risk and test coverage.');
  });
});

describe('importFromCodex: scoped AGENTS filtering', () => {
  it('imports only intended scoped AGENTS.md files and skips hidden and fixture locations', async () => {
    writeFileSync(join(TEST_DIR, AGENTS_MD), '# Root Codex Rules\n');
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'AGENTS.md'), '# Src Rules\n');
    mkdirSync(join(TEST_DIR, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md'),
      'stale hidden rule',
    );
    writeFileSync(
      join(TEST_DIR, '.agentsbridge', 'rules', 'tests-e2e-fixtures-codex-project.md'),
      'stale fixture rule',
    );
    mkdirSync(join(TEST_DIR, '.worktrees', 'security-collaboration'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.worktrees', 'security-collaboration', 'AGENTS.md'),
      '# Hidden Worktree Rules\n',
    );
    mkdirSync(join(TEST_DIR, 'tests', 'e2e', 'fixtures', 'codex-project'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'tests', 'e2e', 'fixtures', 'codex-project', 'AGENTS.md'),
      '# Fixture Rules\n',
    );

    const results = await importFromCodex(TEST_DIR);

    expect(
      results
        .filter((r) => r.feature === 'rules')
        .map((r) => r.toPath)
        .sort(),
    ).toEqual(['.agentsbridge/rules/_root.md', '.agentsbridge/rules/src.md']);
    expect(
      existsSync(join(TEST_DIR, '.agentsbridge', 'rules', '.worktrees-security-collaboration.md')),
    ).toBe(false);
    expect(
      existsSync(join(TEST_DIR, '.agentsbridge', 'rules', 'tests-e2e-fixtures-codex-project.md')),
    ).toBe(false);
  });
});

describe('importFromCodex: MCP', () => {
  it('imports mcp_servers from .codex/config.toml', async () => {
    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    const toml = `[mcp_servers.my-server]\ncommand = "npx"\nargs = ["-y", "@my/server"]\n`;
    writeFileSync(join(TEST_DIR, CODEX_CONFIG_TOML), toml);
    const results = await importFromCodex(TEST_DIR);
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('codex-cli');
    expect(mcpResult!.toPath).toBe('.agentsbridge/mcp.json');
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['my-server']).toBeDefined();
  });

  it('imports env vars from config.toml MCP server', async () => {
    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    const toml = `[mcp_servers.server]\ncommand = "node"\nargs = []\n\n[mcp_servers.server.env]\nAPI_KEY = "secret"\n`;
    writeFileSync(join(TEST_DIR, CODEX_CONFIG_TOML), toml);
    const results = await importFromCodex(TEST_DIR);
    expect(results.find((r) => r.feature === 'mcp')).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsbridge', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as {
      mcpServers: Record<string, { env: Record<string, string> }>;
    };
    expect(parsed.mcpServers['server']!.env['API_KEY']).toBe('secret');
  });

  it('returns no MCP result when config.toml has no mcp_servers', async () => {
    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(TEST_DIR, CODEX_CONFIG_TOML), 'model = "gpt-5-codex"\n');
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
  });

  it('returns no MCP result when config.toml absent', async () => {
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
  });

  it('handles malformed TOML gracefully', async () => {
    const codexDir = join(TEST_DIR, '.codex');
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(join(TEST_DIR, CODEX_CONFIG_TOML), '[[[ not valid toml\n');
    const results = await importFromCodex(TEST_DIR);
    expect(results.filter((r) => r.feature === 'mcp')).toHaveLength(0);
  });
});
