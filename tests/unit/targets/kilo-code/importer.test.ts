import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromKiloCode } from '../../../../src/targets/kilo-code/importer.js';
import {
  KILO_CODE_ROOT_RULE,
  KILO_CODE_RULES_DIR,
  KILO_CODE_COMMANDS_DIR,
  KILO_CODE_AGENTS_DIR,
  KILO_CODE_SKILLS_DIR,
  KILO_CODE_MCP_FILE,
  KILO_CODE_IGNORE,
  KILO_CODE_LEGACY_RULES_DIR,
  KILO_CODE_LEGACY_WORKFLOWS_DIR,
  KILO_CODE_LEGACY_SKILLS_DIR,
  KILO_CODE_LEGACY_MCP_FILE,
  KILO_CODE_LEGACY_MODES_FILE,
} from '../../../../src/targets/kilo-code/constants.js';

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), 'am-kilo-code-importer-'));
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function toPaths(results: { toPath: string }[]): string[] {
  return results.map((result) => result.toPath).sort();
}

describe('importFromKiloCode — empty project', () => {
  it('returns empty array when no kilo-code files exist', async () => {
    const results = await importFromKiloCode(TEST_DIR);
    expect(results).toEqual([]);
  });
});

describe('importFromKiloCode — root rule', () => {
  it('imports AGENTS.md as canonical _root.md with root: true frontmatter', async () => {
    writeFileSync(join(TEST_DIR, KILO_CODE_ROOT_RULE), '# Kilo Project\n\nUse TDD.');

    const results = await importFromKiloCode(TEST_DIR);
    expect(toPaths(results)).toEqual(['.agentsmesh/rules/_root.md']);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('root: true');
    expect(content).toContain('Use TDD.');
  });

  it('strips the agentsmesh decoration paragraph on round-trip import', async () => {
    const decorated = [
      '# Root',
      '',
      'Project rules.',
      '',
      'For details, see the `.agentsmesh` directory at the project root.',
      '',
    ].join('\n');
    writeFileSync(join(TEST_DIR, KILO_CODE_ROOT_RULE), decorated);

    const results = await importFromKiloCode(TEST_DIR);
    const rootResult = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');
    expect(rootResult).toBeDefined();
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(content).toContain('Project rules.');
  });
});

describe('importFromKiloCode — non-root rules (new layout)', () => {
  it('imports .kilo/rules/<slug>.md', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_RULES_DIR, 'typescript.md'),
      '---\ndescription: TS rules\n---\n\nUse strict TS.',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/typescript.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'), 'utf-8');
    expect(content).toContain('root: false');
    expect(content).toContain('description: TS rules');
    expect(content).toContain('Use strict TS.');
  });
});

describe('importFromKiloCode — non-root rules (legacy layout)', () => {
  it('imports .kilocode/rules/<slug>.md alongside new-layout rules', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KILO_CODE_RULES_DIR, 'new-style.md'), 'New-style rule.');
    mkdirSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR, 'legacy-style.md'),
      'Legacy-style rule.',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/new-style.md')).toBe(true);
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/legacy-style.md')).toBe(true);
    const newContent = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'new-style.md'),
      'utf-8',
    );
    const legacyContent = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'legacy-style.md'),
      'utf-8',
    );
    expect(newContent).toContain('New-style rule.');
    expect(legacyContent).toContain('Legacy-style rule.');
  });

  it('promotes legacy .kilocode/rules/00-root.md to canonical root rule', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR, '00-root.md'), '# Legacy Root');
    writeFileSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR, 'feature.md'), 'Feature rule.');

    const results = await importFromKiloCode(TEST_DIR);
    expect(toPaths(results)).toEqual([
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/feature.md',
    ]);
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      'root: true',
    );
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      '# Legacy Root',
    );
  });

  it('lets current AGENTS.md win over legacy .kilocode/rules/00-root.md', async () => {
    writeFileSync(join(TEST_DIR, KILO_CODE_ROOT_RULE), '# Current Root');
    mkdirSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, KILO_CODE_LEGACY_RULES_DIR, '00-root.md'), '# Legacy Root');

    const results = await importFromKiloCode(TEST_DIR);
    expect(toPaths(results)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8')).toContain(
      '# Current Root',
    );
  });
});

describe('importFromKiloCode — commands', () => {
  it('imports .kilo/commands/<name>.md', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_COMMANDS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_COMMANDS_DIR, 'review.md'),
      '---\ndescription: Review command\n---\n\nReview all files.',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/commands/review.md')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'commands', 'review.md'), 'utf-8');
    expect(content).toContain('Review all files.');
    expect(content).toContain('description: Review command');
  });

  it('imports legacy .kilocode/workflows/<name>.md as canonical commands', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_LEGACY_WORKFLOWS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_WORKFLOWS_DIR, 'plan-phase.md'),
      '---\ndescription: Plan a delivery phase\n---\n\nGather context, then plan.',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/commands/plan-phase.md')).toBe(true);
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'commands', 'plan-phase.md'),
      'utf-8',
    );
    expect(content).toContain('Gather context, then plan.');
  });
});

describe('importFromKiloCode — agents (native subagents)', () => {
  it('imports .kilo/agents/<name>.md as canonical agent', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_AGENTS_DIR), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_AGENTS_DIR, 'code-reviewer.md'),
      [
        '---',
        'description: Reviews code for quality',
        'mode: subagent',
        'model: anthropic/claude-sonnet-4-20250514',
        '---',
        '',
        'You are an expert code reviewer.',
      ].join('\n'),
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/code-reviewer.md')).toBe(true);
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'code-reviewer.md'),
      'utf-8',
    );
    expect(content).toContain('description: Reviews code for quality');
    expect(content).toContain('You are an expert code reviewer.');
  });
});

describe('importFromKiloCode — agents (legacy .kilocodemodes)', () => {
  it('imports .kilocodemodes customModes into .agentsmesh/agents/<slug>.md', async () => {
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_MODES_FILE),
      [
        'customModes:',
        '  - slug: gsd-codebase-mapper',
        '    name: GSD Codebase Mapper',
        '    description: Explores codebase and writes structured analysis',
        '    roleDefinition: |',
        '      You are a GSD codebase mapper.',
        '      Map the structure of the workspace.',
        '    whenToUse: When mapping or analysing codebase structure.',
        '',
      ].join('\n'),
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/gsd-codebase-mapper.md')).toBe(
      true,
    );
    const content = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'agents', 'gsd-codebase-mapper.md'),
      'utf-8',
    );
    expect(content).toContain('description: Explores codebase and writes structured analysis');
    expect(content).toContain('You are a GSD codebase mapper.');
    expect(content).toContain('## When to use');
    expect(content).toContain('When mapping or analysing codebase structure.');
  });

  it('skips customModes entries without a slug', async () => {
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_MODES_FILE),
      ['customModes:', '  - name: Nameless', '    description: Should be skipped', ''].join('\n'),
    );

    const results = await importFromKiloCode(TEST_DIR);
    const agentResults = results.filter((r) => r.feature === 'agents');
    expect(agentResults).toHaveLength(0);
  });

  it('does not crash on malformed .kilocodemodes YAML', async () => {
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_MODES_FILE),
      'this is not yaml: { broken: missing\ncustomModes:\n  - garbage\n',
    );

    await expect(importFromKiloCode(TEST_DIR)).resolves.toEqual([]);
  });

  it('does not crash on .kilocodemodes with non-array customModes', async () => {
    writeFileSync(join(TEST_DIR, KILO_CODE_LEGACY_MODES_FILE), 'customModes: not-an-array\n');

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.filter((r) => r.feature === 'agents')).toEqual([]);
  });
});

describe('importFromKiloCode — MCP', () => {
  it('imports .kilo/mcp.json as canonical mcp', async () => {
    mkdirSync(join(TEST_DIR, '.kilo'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_MCP_FILE),
      JSON.stringify({
        mcpServers: {
          'test-server': { command: 'node', args: ['server.js'] },
        },
      }),
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['test-server']).toBeDefined();
  });

  it('falls back to .kilocode/mcp.json when .kilo/mcp.json is absent', async () => {
    mkdirSync(join(TEST_DIR, '.kilocode'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_MCP_FILE),
      JSON.stringify({
        mcpServers: {
          'legacy-server': { command: 'python', args: ['server.py'] },
        },
      }),
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/mcp.json')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['legacy-server']).toBeDefined();
  });
});

describe('importFromKiloCode — ignore', () => {
  it('imports .kilocodeignore as canonical ignore', async () => {
    writeFileSync(join(TEST_DIR, KILO_CODE_IGNORE), '.env\nnode_modules/\n');

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.toPath === '.agentsmesh/ignore')).toBe(true);
    const content = readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8');
    expect(content).toContain('.env');
    expect(content).toContain('node_modules/');
  });
});

describe('importFromKiloCode — skills', () => {
  it('imports .kilo/skills/<slug>/SKILL.md', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_SKILLS_DIR, 'api-generator'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_SKILLS_DIR, 'api-generator', 'SKILL.md'),
      '---\nname: api-generator\ndescription: Generate REST endpoints\n---\n\n# API Generator',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(results.some((r) => r.feature === 'skills')).toBe(true);
  });

  it('imports legacy .kilocode/skills/<slug>/SKILL.md alongside new-layout skills', async () => {
    mkdirSync(join(TEST_DIR, KILO_CODE_LEGACY_SKILLS_DIR, 'visual-regression'), {
      recursive: true,
    });
    writeFileSync(
      join(TEST_DIR, KILO_CODE_LEGACY_SKILLS_DIR, 'visual-regression', 'SKILL.md'),
      '---\nname: visual-regression\ndescription: Visual regression tests\n---\n\n# Visual regression',
    );

    const results = await importFromKiloCode(TEST_DIR);
    expect(
      results.some(
        (r) => r.feature === 'skills' && r.toPath.includes('visual-regression/SKILL.md'),
      ),
    ).toBe(true);
  });
});
