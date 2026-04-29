import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importGeminiSkillsAndAgents } from '../../../../src/targets/gemini-cli/importer-skills-agents.js';
import { generateGeminiPermissionsPolicies } from '../../../../src/targets/gemini-cli/policies-generator.js';
import type { ImportResult } from '../../../../src/core/types.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

let projectRoot: string;
const noopNorm = (c: string): string => c;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-rem-gemini-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('importGeminiSkillsAndAgents — extra branches', () => {
  it('imports a skill with SKILL.md and supporting files (lines 35–86)', async () => {
    writeFile(
      '.gemini/skills/my-skill/SKILL.md',
      '---\nname: my-skill\ndescription: A skill\n---\nSkill body',
    );
    writeFile('.gemini/skills/my-skill/script.sh', 'echo hi');
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results.find((r) => r.feature === 'skills')).toBeDefined();
    // Supporting file should be picked up
    expect(results.some((r) => r.toPath.endsWith('script.sh'))).toBe(true);
  });

  it('skips empty SKILL.md content (line 35 true short-circuit)', async () => {
    writeFile('.gemini/skills/empty-skill/SKILL.md', '');
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results).toEqual([]);
  });

  it('imports a projected agent skill (line 39 true branch)', async () => {
    writeFile(
      '.gemini/skills/am-agent-reviewer/SKILL.md',
      '---\ndescription: An agent\nx-agentsmesh-kind: agent\nx-agentsmesh-name: reviewer\n---\nbody',
    );
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    // Projected agent goes to agents/, not skills/ dir
    expect(results.some((r) => r.toPath === '.agentsmesh/agents/reviewer.md')).toBe(true);
  });

  it('imports a Gemini agent .md (lines 92–131)', async () => {
    writeFile(
      '.gemini/agents/coder.md',
      '---\nname: coder\ndescription: Coder agent\nmaxTurns: 3\n---\nagent body',
    );
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results.some((r) => r.feature === 'agents')).toBe(true);
  });

  it('imports a Gemini agent using kebab-case fields', async () => {
    writeFile(
      '.gemini/agents/coder2.md',
      '---\nname: coder2\ndescription: Coder agent\nmax-turns: 5\npermission-mode: ask\ndisallowed-tools: ["Bash"]\n---\nbody',
    );
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results.some((r) => r.feature === 'agents')).toBe(true);
  });

  it('imports a Gemini agent using snake_case fields', async () => {
    writeFile(
      '.gemini/agents/coder3.md',
      '---\nname: coder3\ndescription: x\nmax_turns: 7\npermission_mode: deny\ndisallowed_tools: ["Bash"]\n---\nbody',
    );
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results.some((r) => r.feature === 'agents')).toBe(true);
  });

  it('imports a Gemini agent without name field (basename fallback line 109)', async () => {
    writeFile('.gemini/agents/anon.md', '---\ndescription: x\n---\nbody');
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results.find((r) => r.toPath.endsWith('/anon.md'))).toBeDefined();
  });

  it('skips empty agent .md content (line 94 true)', async () => {
    writeFile('.gemini/agents/empty-agent.md', '');
    const results: ImportResult[] = [];
    await importGeminiSkillsAndAgents(projectRoot, results, noopNorm);
    expect(results).toEqual([]);
  });
});

function emptyCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

describe('generateGeminiPermissionsPolicies — extra branches', () => {
  it('returns [] when permissions is null', () => {
    expect(generateGeminiPermissionsPolicies(emptyCanonical())).toEqual([]);
  });

  it('returns [] when allow+deny both empty', () => {
    const c = emptyCanonical({ permissions: { allow: [], deny: [] } as never });
    expect(generateGeminiPermissionsPolicies(c)).toEqual([]);
  });

  it('emits rules for various permission expression kinds', () => {
    const c = emptyCanonical({
      permissions: {
        allow: ['Read', 'Bash(git:*)', 'Read(/etc/*)', 'CustomTool'],
        deny: ['Grep'],
      } as never,
    });
    const out = generateGeminiPermissionsPolicies(c);
    expect(out).toHaveLength(1);
    const content = out[0]!.content;
    expect(content).toContain('decision = "allow"');
    expect(content).toContain('decision = "deny"');
    expect(content).toContain('commandPrefix = "git"');
    expect(content).toContain('argsPattern');
  });
});
