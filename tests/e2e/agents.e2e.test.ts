/**
 * E2E tests: agent import/generate using the canonical full fixture as the
 * source of truth.
 *
 * For every canonical agent and every relevant target the suite checks:
 *   GENERATE   canonical fixture → target-format agent files
 *   IMPORT     target-format agent files → canonical files
 *   ROUND-TRIP generate then import, final canonical matches the fixture
 *
 * Targets with native agent support: claude-code, cursor, copilot
 * Targets with embedded agent support via skills:
 *   cline, codex-cli, windsurf, gemini-cli
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { createCanonicalProject as setupCanonicalProject } from './helpers/canonical.js';
import { fileExists, fileContains } from './helpers/assertions.js';

// ── Reference data ─────────────────────────────────────────────────────────

type AgentExpectation = {
  bodySnippet: string;
  description: string;
  disallowedTools: string[];
  maxTurns: number;
  model: string;
  permissionMode: string;
  tools: string[];
};

const CANONICAL_AGENTS_DIR = join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'canonical-full',
  '.agentsbridge',
  'agents',
);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from an agent file and return a flat record.
 * Handles both camelCase (permissionMode, maxTurns, disallowedTools)
 * and kebab-case (permission-mode, max-turns, disallowed-tools) keys.
 */
function parseFm(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, 'utf-8');
  const open = raw.indexOf('---');
  if (open !== 0) return {};
  const close = raw.indexOf('---', 3);
  if (close === -1) return {};
  return (parseYaml(raw.slice(3, close).trim()) as Record<string, unknown>) ?? {};
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string')
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function bodyWithoutFrontmatter(raw: string): string {
  const match = raw.match(/^---\n[\s\S]*?\n---\n*/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

function extractBodySnippet(raw: string): string {
  return (
    bodyWithoutFrontmatter(raw)
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  );
}

function loadCanonicalAgents(): Record<string, AgentExpectation> {
  const agents = readdirSync(CANONICAL_AGENTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort();

  return Object.fromEntries(
    agents.map((file) => {
      const raw = readFileSync(join(CANONICAL_AGENTS_DIR, file), 'utf-8');
      const fm = parseFm(join(CANONICAL_AGENTS_DIR, file));
      return [
        file.replace(/\.md$/, ''),
        {
          bodySnippet: extractBodySnippet(raw),
          description: String(fm.description ?? ''),
          disallowedTools: toStringArray(fm.disallowedTools ?? fm['disallowed-tools']),
          maxTurns: Number(fm.maxTurns ?? fm['max-turns'] ?? 0),
          model: String(fm.model ?? ''),
          permissionMode: String(fm.permissionMode ?? fm['permission-mode'] ?? ''),
          tools: toStringArray(fm.tools),
        },
      ];
    }),
  );
}

const AGENTS = loadCanonicalAgents();
const AGENT_NAMES = Object.keys(AGENTS);

/**
 * Assert that an agent file (target-format or canonical) contains all expected
 * fields from the canonical fixture for the given agent name.
 */
function assertAllAgentFields(filePath: string, name: string): void {
  fileExists(filePath);
  const agent = AGENTS[name];
  const fm = parseFm(filePath);
  const raw = readFileSync(filePath, 'utf-8');

  // description
  const desc = String(fm.description ?? '');
  expect(desc, `${name}: description`).toBe(agent.description);

  // model
  const model = String(fm.model ?? '');
  expect(model, `${name}: model`).toBe(agent.model);

  // tools (at least the distinctive ones)
  const tools = toStringArray(fm.tools);
  for (const tool of agent.tools) {
    expect(tools, `${name}: tools should contain ${tool}`).toContain(tool);
  }

  // disallowedTools / disallowed-tools
  const disallowed = toStringArray(fm.disallowedTools ?? fm['disallowed-tools']);
  for (const dt of agent.disallowedTools) {
    expect(disallowed, `${name}: disallowedTools should contain ${dt}`).toContain(dt);
  }

  // permissionMode / permission-mode
  if (agent.permissionMode) {
    const pm = String(fm.permissionMode ?? fm['permission-mode'] ?? '');
    expect(pm, `${name}: permissionMode`).toBe(agent.permissionMode);
  }

  // maxTurns / max-turns
  const mt = Number(fm.maxTurns ?? fm['max-turns'] ?? 0);
  expect(mt, `${name}: maxTurns`).toBe(agent.maxTurns);

  // body
  expect(raw, `${name}: body snippet`).toContain(agent.bodySnippet);
}

function projectedAgentSkillPath(target: string, name: string): string {
  switch (target) {
    case 'cline':
      return `.cline/skills/ab-agent-${name}/SKILL.md`;
    case 'windsurf':
      return `.windsurf/skills/ab-agent-${name}/SKILL.md`;
    default:
      throw new Error(`Unsupported projected-agent target: ${target}`);
  }
}

function assertProjectedAgentFields(filePath: string, name: string): void {
  fileExists(filePath);
  const agent = AGENTS[name];
  const fm = parseFm(filePath);
  const raw = readFileSync(filePath, 'utf-8');

  expect(String(fm.description ?? ''), `${name}: projected description`).toBe(agent.description);
  expect(String(fm['x-agentsbridge-kind'] ?? ''), `${name}: projected kind`).toBe('agent');
  expect(String(fm['x-agentsbridge-name'] ?? ''), `${name}: projected name`).toBe(name);
  expect(String(fm['x-agentsbridge-model'] ?? ''), `${name}: projected model`).toBe(agent.model);
  expect(
    String(fm['x-agentsbridge-permission-mode'] ?? ''),
    `${name}: projected permissionMode`,
  ).toBe(agent.permissionMode);
  expect(Number(fm['x-agentsbridge-max-turns'] ?? 0), `${name}: projected maxTurns`).toBe(
    agent.maxTurns,
  );

  const tools = toStringArray(fm['x-agentsbridge-tools']);
  for (const tool of agent.tools) {
    expect(tools, `${name}: projected tools should contain ${tool}`).toContain(tool);
  }

  const disallowed = toStringArray(fm['x-agentsbridge-disallowed-tools']);
  for (const dt of agent.disallowedTools) {
    expect(disallowed, `${name}: projected disallowedTools should contain ${dt}`).toContain(dt);
  }

  expect(raw, `${name}: projected body snippet`).toContain(agent.bodySnippet);
}

// ── GENERATE tests ─────────────────────────────────────────────────────────

describe('agents: generate from canonical fixture', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  // ── claude-code ────────────────────────────────────────────────────────

  for (const name of AGENT_NAMES) {
    it(`claude-code: generates ${name} with all fields`, async () => {
      dir = setupCanonicalProject();
      const r = await runCli('generate --targets claude-code', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const agentPath = join(dir, '.claude', 'agents', `${name}.md`);
      assertAllAgentFields(agentPath, name);
    });
  }

  // ── cursor ─────────────────────────────────────────────────────────────

  for (const name of AGENT_NAMES) {
    it(`cursor: generates ${name} with all fields`, async () => {
      dir = setupCanonicalProject();
      const r = await runCli('generate --targets cursor', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const agentPath = join(dir, '.cursor', 'agents', `${name}.md`);
      assertAllAgentFields(agentPath, name);
    });
  }

  // ── copilot (native .github/agents/*.agent.md) ──────────────────────────

  it('copilot: canonical agents are emitted in native .github/agents/*.agent.md', async () => {
    dir = setupCanonicalProject();
    const r = await runCli('generate --targets copilot', dir);
    expect(r.exitCode, r.stderr).toBe(0);

    const instructionsPath = join(dir, '.github', 'copilot-instructions.md');
    fileExists(instructionsPath);

    for (const name of AGENT_NAMES) {
      const agentPath = join(dir, '.github', 'agents', `${name}.agent.md`);
      fileExists(agentPath);
      const agent = AGENTS[name];
      fileContains(agentPath, agent.description);
      fileContains(agentPath, agent.bodySnippet);
    }
  });

  // ── embedded agent targets (projected into skills) ─────────────────────

  it.each(['cline', 'windsurf'] as const)(
    '%s: generates projected agent skills with round-trip metadata',
    async (target) => {
      dir = setupCanonicalProject();
      const r = await runCli(`generate --targets ${target}`, dir);
      expect(r.exitCode, r.stderr).toBe(0);

      for (const name of AGENT_NAMES) {
        assertProjectedAgentFields(join(dir, projectedAgentSkillPath(target, name)), name);
      }
    },
  );

  // ── codex-cli (native .codex/agents/*.toml) ────────────────────────────

  for (const name of AGENT_NAMES) {
    it(`codex-cli: generates ${name} in native .codex/agents/*.toml`, async () => {
      dir = setupCanonicalProject();
      const r = await runCli('generate --targets codex-cli', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const agentPath = join(dir, '.codex', 'agents', `${name}.toml`);
      fileExists(agentPath);
      const content = readFileSync(agentPath, 'utf-8');
      const agent = AGENTS[name];
      expect(content).toContain(`name = "${name}"`);
      expect(content).toContain(agent.description);
      expect(content).toContain(agent.model);
      expect(content).toContain(agent.bodySnippet);
    });
  }

  // ── gemini-cli (native .gemini/agents/*.md) ───────────────────────────

  for (const name of AGENT_NAMES) {
    it(`gemini-cli: generates ${name} with all fields in native .gemini/agents/`, async () => {
      dir = setupCanonicalProject();
      const r = await runCli('generate --targets gemini-cli', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const agentPath = join(dir, '.gemini', 'agents', `${name}.md`);
      assertAllAgentFields(agentPath, name);
    });
  }
});

// ── IMPORT tests ────────────────────────────────────────────────────────────

describe('agents: import back to canonical', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  // ── claude-code ────────────────────────────────────────────────────────

  for (const name of AGENT_NAMES) {
    it(`claude-code: importing ${name} from .claude/agents/ produces canonical with all fields`, async () => {
      dir = createTestProject();
      const agent = AGENTS[name];

      // Reconstruct the native agent file from canonical fixture data.
      mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
      const canonicalContent = readFileSync(join(CANONICAL_AGENTS_DIR, `${name}.md`), 'utf-8');
      writeFileSync(join(dir, '.claude', 'agents', `${name}.md`), canonicalContent);

      const r = await runCli('import --from claude-code', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const canonicalPath = join(dir, '.agentsbridge', 'agents', `${name}.md`);
      fileExists(canonicalPath);

      const raw = readFileSync(canonicalPath, 'utf-8');
      expect(raw).toContain(agent.description);
      expect(raw).toContain(agent.model);
      expect(raw).toContain(agent.bodySnippet);
      for (const tool of agent.tools) {
        expect(raw, `${name}: tool ${tool}`).toContain(tool);
      }
      for (const dt of agent.disallowedTools) {
        expect(raw, `${name}: disallowed ${dt}`).toContain(dt);
      }
      if (agent.permissionMode) {
        expect(raw).toContain(agent.permissionMode);
      }
      expect(raw).toContain(String(agent.maxTurns));
    });
  }

  // ── cursor ─────────────────────────────────────────────────────────────

  for (const name of AGENT_NAMES) {
    it(`cursor: importing ${name} from .cursor/agents/ produces canonical with all fields`, async () => {
      dir = createTestProject();
      const agent = AGENTS[name];

      mkdirSync(join(dir, '.cursor', 'agents'), { recursive: true });
      const canonicalContent = readFileSync(join(CANONICAL_AGENTS_DIR, `${name}.md`), 'utf-8');
      writeFileSync(join(dir, '.cursor', 'agents', `${name}.md`), canonicalContent);

      const r = await runCli('import --from cursor', dir);
      expect(r.exitCode, r.stderr).toBe(0);

      const canonicalPath = join(dir, '.agentsbridge', 'agents', `${name}.md`);
      fileExists(canonicalPath);

      const raw = readFileSync(canonicalPath, 'utf-8');
      expect(raw).toContain(agent.description);
      expect(raw).toContain(agent.model);
      expect(raw).toContain(agent.bodySnippet);
      for (const tool of agent.tools) {
        expect(raw, `${name}: tool ${tool}`).toContain(tool);
      }
      for (const dt of agent.disallowedTools) {
        expect(raw, `${name}: disallowed ${dt}`).toContain(dt);
      }
      if (agent.permissionMode) {
        expect(raw).toContain(agent.permissionMode);
      }
      expect(raw).toContain(String(agent.maxTurns));
    });
  }

  // ── copilot (.github/agents/*.agent.md) ─────────────────────────────────────

  it('copilot: importing from .github/agents/*.agent.md produces canonical agents', async () => {
    dir = setupCanonicalProject();

    // Generate Copilot-format .agent.md files from the canonical fixture
    const genResult = await runCli('generate --targets copilot', dir);
    expect(genResult.exitCode, genResult.stderr).toBe(0);

    // Remove canonical agents to test import
    const { rmSync } = await import('node:fs');
    rmSync(join(dir, '.agentsbridge', 'agents'), { recursive: true, force: true });

    const r = await runCli('import --from copilot', dir);
    expect(r.exitCode, r.stderr).toBe(0);

    // Copilot format does not include disallowedTools, permissionMode, maxTurns
    for (const name of AGENT_NAMES) {
      const canonicalPath = join(dir, '.agentsbridge', 'agents', `${name}.md`);
      fileExists(canonicalPath);
      const agent = AGENTS[name];
      const raw = readFileSync(canonicalPath, 'utf-8');
      expect(raw).toContain(agent.description);
      expect(raw).toContain(agent.model);
      expect(raw).toContain(agent.bodySnippet);
      for (const tool of agent.tools) {
        expect(raw, `${name}: tool ${tool}`).toContain(tool);
      }
    }
  });

  it.each(['cline', 'windsurf', 'gemini-cli'] as const)(
    '%s: importing projected agent skills restores canonical agents with all fields',
    async (target) => {
      dir = setupCanonicalProject();

      const genResult = await runCli(`generate --targets ${target}`, dir);
      expect(genResult.exitCode, genResult.stderr).toBe(0);

      const { rmSync } = await import('node:fs');
      rmSync(join(dir, '.agentsbridge', 'agents'), { recursive: true, force: true });

      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, importResult.stderr).toBe(0);

      for (const name of AGENT_NAMES) {
        assertAllAgentFields(join(dir, '.agentsbridge', 'agents', `${name}.md`), name);
      }
    },
  );

  it('codex-cli: importing from .codex/agents/*.toml restores canonical agents (description, model, body)', async () => {
    dir = setupCanonicalProject();

    const genResult = await runCli('generate --targets codex-cli', dir);
    expect(genResult.exitCode, genResult.stderr).toBe(0);

    const { rmSync } = await import('node:fs');
    rmSync(join(dir, '.agentsbridge', 'agents'), { recursive: true, force: true });

    const importResult = await runCli('import --from codex-cli', dir);
    expect(importResult.exitCode, importResult.stderr).toBe(0);

    for (const name of AGENT_NAMES) {
      const path = join(dir, '.agentsbridge', 'agents', `${name}.md`);
      fileExists(path);
      const raw = readFileSync(path, 'utf-8');
      const agent = AGENTS[name];
      expect(raw).toContain(agent.description);
      expect(raw).toContain(agent.model);
      expect(raw).toContain(agent.bodySnippet);
    }
  });
});

// ── ROUND-TRIP tests ────────────────────────────────────────────────────────

describe('agents: round-trip (generate → import → compare with canonical fixture)', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  for (const target of [
    'claude-code',
    'cursor',
    'cline',
    'codex-cli',
    'windsurf',
    'gemini-cli',
  ] as const) {
    it(`${target}: canonical agents survive generate→import with all fields intact`, async () => {
      dir = setupCanonicalProject();

      // Step 1: generate target-format agent files from canonical fixture
      const genResult = await runCli(`generate --targets ${target}`, dir);
      expect(genResult.exitCode, `generate failed: ${genResult.stderr}`).toBe(0);

      // Step 2: import back from target format (overwrites canonical agents)
      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, `import failed: ${importResult.stderr}`).toBe(0);

      const codexOnly = target === 'codex-cli';

      // Step 3: verify each agent in canonical matches the original fixture
      for (const name of AGENT_NAMES) {
        const canonicalPath = join(dir, '.agentsbridge', 'agents', `${name}.md`);
        fileExists(canonicalPath);

        const fm = parseFm(canonicalPath);
        const raw = readFileSync(canonicalPath, 'utf-8');
        const agent = AGENTS[name];

        // description
        const desc = String(fm.description ?? '');
        expect(desc, `${target}/${name}: description`).toBe(agent.description);

        // model
        const model = String(fm.model ?? '');
        expect(model, `${target}/${name}: model`).toBe(agent.model);

        if (!codexOnly) {
          // tools (all must be present) — codex TOML does not support tools
          const tools = toStringArray(fm.tools);
          for (const tool of agent.tools) {
            expect(tools, `${target}/${name}: tool ${tool}`).toContain(tool);
          }

          // disallowedTools
          const disallowed = toStringArray(fm.disallowedTools ?? fm['disallowed-tools']);
          for (const dt of agent.disallowedTools) {
            expect(disallowed, `${target}/${name}: disallowed ${dt}`).toContain(dt);
          }

          // permissionMode
          if (agent.permissionMode) {
            const pm = String(fm.permissionMode ?? fm['permission-mode'] ?? '');
            expect(pm, `${target}/${name}: permissionMode`).toBe(agent.permissionMode);
          }

          // maxTurns
          const mt = Number(fm.maxTurns ?? fm['max-turns'] ?? 0);
          expect(mt, `${target}/${name}: maxTurns`).toBe(agent.maxTurns);
        }

        // body
        expect(raw, `${target}/${name}: body snippet`).toContain(agent.bodySnippet);
      }
    });

    it(`${target}: round-trip preserves the canonical agent file list`, async () => {
      dir = setupCanonicalProject();

      const genResult = await runCli(`generate --targets ${target}`, dir);
      expect(genResult.exitCode, genResult.stderr).toBe(0);

      const importResult = await runCli(`import --from ${target}`, dir);
      expect(importResult.exitCode, importResult.stderr).toBe(0);

      // Both agents exist in canonical
      for (const name of AGENT_NAMES) {
        fileExists(join(dir, '.agentsbridge', 'agents', `${name}.md`));
      }

      // No unexpected extra agent files appeared
      const { readdirSync } = await import('node:fs');
      const canonicalAgentsDir = join(dir, '.agentsbridge', 'agents');
      const files = readdirSync(canonicalAgentsDir).filter((f) => f.endsWith('.md'));
      expect(files.sort()).toEqual(AGENT_NAMES.map((name) => `${name}.md`).sort());
    });
  }

  // ── copilot (native .github/agents/*.agent.md) ────────────────────────────

  it('copilot: generate→import preserves description, tools, model, body (Copilot does not support disallowedTools/permissionMode/maxTurns)', async () => {
    dir = setupCanonicalProject();

    const genResult = await runCli('generate --targets copilot', dir);
    expect(genResult.exitCode, genResult.stderr).toBe(0);

    const { rmSync } = await import('node:fs');
    rmSync(join(dir, '.agentsbridge', 'agents'), { recursive: true, force: true });

    const importResult = await runCli('import --from copilot', dir);
    expect(importResult.exitCode, importResult.stderr).toBe(0);

    for (const name of AGENT_NAMES) {
      const canonicalPath = join(dir, '.agentsbridge', 'agents', `${name}.md`);
      fileExists(canonicalPath);
      const fm = parseFm(canonicalPath);
      const raw = readFileSync(canonicalPath, 'utf-8');
      const agent = AGENTS[name];

      expect(String(fm.description ?? ''), `${name}: description`).toBe(agent.description);
      expect(String(fm.model ?? ''), `${name}: model`).toBe(agent.model);
      const tools = toStringArray(fm.tools);
      for (const tool of agent.tools) {
        expect(tools, `${name}: tool ${tool}`).toContain(tool);
      }
      expect(raw, `${name}: body snippet`).toContain(agent.bodySnippet);
    }
  });

  // ── cross-target consistency ────────────────────────────────────────────

  it('claude-code and cursor generate identical agent field values for the canonical agents', async () => {
    const dirCC = setupCanonicalProject();
    const dirCursor = setupCanonicalProject();

    try {
      await runCli('generate --targets claude-code', dirCC);
      await runCli('generate --targets cursor', dirCursor);

      for (const name of AGENT_NAMES) {
        const ccPath = join(dirCC, '.claude', 'agents', `${name}.md`);
        const cursorPath = join(dirCursor, '.cursor', 'agents', `${name}.md`);

        const ccFm = parseFm(ccPath);
        const cursorFm = parseFm(cursorPath);

        // Both should produce the same description and model
        expect(String(ccFm.description ?? ''), `${name}: cc description`).toBe(
          String(cursorFm.description ?? ''),
        );
        expect(String(ccFm.model ?? ''), `${name}: cc model`).toBe(String(cursorFm.model ?? ''));

        const ccTools = toStringArray(ccFm.tools);
        const cursorTools = toStringArray(cursorFm.tools);
        expect(ccTools.sort(), `${name}: cc tools`).toEqual(cursorTools.sort());

        const ccMt = Number(ccFm.maxTurns ?? ccFm['max-turns'] ?? 0);
        const cursorMt = Number(cursorFm.maxTurns ?? cursorFm['max-turns'] ?? 0);
        expect(ccMt, `${name}: cc maxTurns`).toBe(cursorMt);
      }
    } finally {
      cleanup(dirCC);
      cleanup(dirCursor);
    }
  });
});

// ── FILE MANIFEST ────────────────────────────────────────────────────────────
//
// Runs a complete cycle for every relevant target and writes a report to
// tests/e2e/agents-last-run.md after every successful e2e run.

const REPORT_PATH = join(process.cwd(), 'tests', 'e2e', 'agents-last-run.md');
const NATIVE_TARGETS = ['claude-code', 'cursor'] as const;
const EMBEDDED_TARGETS = ['cline', 'windsurf'] as const;
const NATIVE_AGENT_TOML_TARGETS = ['codex-cli'] as const;
const NATIVE_AGENT_MD_TARGETS = ['gemini-cli'] as const;

function agentBlock(dir: string, file: string): string {
  const fm = parseFm(join(dir, file));
  const tools = toStringArray(fm.tools);
  const disallowed = toStringArray(fm.disallowedTools ?? fm['disallowed-tools']);
  const pm = fm.permissionMode ?? fm['permission-mode'];
  const lines = [
    `  - **${file}**`,
    `    - description : ${fm.description ?? '(none)'}`,
    `    - model       : ${fm.model ?? '(none)'}`,
    `    - tools       : ${tools.join(', ')}`,
  ];
  if (disallowed.length > 0) lines.push(`    - disallowed  : ${disallowed.join(', ')}`);
  if (pm) lines.push(`    - permission  : ${pm}`);
  lines.push(`    - max-turns   : ${fm.maxTurns ?? fm['max-turns'] ?? '(none)'}`);
  return lines.join('\n');
}

describe('agents: file manifest (written to tests/e2e/agents-last-run.md)', () => {
  let manifestDir: string;

  afterAll(() => {
    if (manifestDir) cleanup(manifestDir);
  });

  it('writes agents-last-run.md with full initial/generated/imported file list', async () => {
    manifestDir = setupCanonicalProject();

    const lines: string[] = [];
    const ts = new Date().toISOString();

    lines.push(`# Agents E2E Last Run Report`);
    lines.push(`\n_Generated: ${ts}_\n`);

    // ── INITIAL ───────────────────────────────────────────────────────────
    const canonicalAgentsDir = join(manifestDir, '.agentsbridge', 'agents');
    const initialFiles = readdirSync(canonicalAgentsDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    lines.push(`## Initial — \`.agentsbridge/agents/\` (canonical fixture)\n`);
    for (const f of initialFiles) {
      lines.push(agentBlock(canonicalAgentsDir, f));
    }

    // ── NATIVE TARGETS (generate + import) ────────────────────────────────
    for (const target of NATIVE_TARGETS) {
      lines.push(`\n## Target: ${target}\n`);

      // generate
      const genResult = await runCli(`generate --targets ${target}`, manifestDir);
      expect(genResult.exitCode, `generate ${target} failed: ${genResult.stderr}`).toBe(0);

      lines.push(`### Generated files\n`);
      lines.push('```');
      lines.push(genResult.stdout || '(no output)');
      lines.push('```\n');

      const agentDir =
        target === 'claude-code'
          ? join(manifestDir, '.claude', 'agents')
          : join(manifestDir, '.cursor', 'agents');
      const generatedAgentFiles = readdirSync(agentDir)
        .filter((f) => f.endsWith('.md'))
        .sort();
      lines.push(`#### Agent files in \`${relative(manifestDir, agentDir)}/\`\n`);
      for (const f of generatedAgentFiles) {
        lines.push(agentBlock(agentDir, f));
      }

      // import
      const importResult = await runCli(`import --from ${target}`, manifestDir);
      expect(importResult.exitCode, `import ${target} failed: ${importResult.stderr}`).toBe(0);

      lines.push(`\n### Imported files\n`);
      lines.push('```');
      lines.push(importResult.stdout || '(no output)');
      lines.push('```\n');

      const reimportedFiles = readdirSync(canonicalAgentsDir)
        .filter((f) => f.endsWith('.md'))
        .sort();
      lines.push(`#### Canonical \`.agentsbridge/agents/\` after import\n`);
      for (const f of reimportedFiles) {
        lines.push(agentBlock(canonicalAgentsDir, f));
      }
    }

    // ── COPILOT (native .github/agents/*.agent.md) ──────────────────────────
    lines.push(`\n## Target: copilot (agents in .github/agents/*.agent.md)\n`);
    const copilotResult = await runCli('generate --targets copilot', manifestDir);
    expect(copilotResult.exitCode, copilotResult.stderr).toBe(0);

    lines.push(`### Generated files\n`);
    lines.push('```');
    lines.push(copilotResult.stdout || '(no output)');
    lines.push('```\n');

    const copilotAgentsDir = join(manifestDir, '.github', 'agents');
    lines.push(`#### Agents in \`.github/agents/*.agent.md\`\n`);
    if (existsSync(copilotAgentsDir)) {
      for (const name of AGENT_NAMES) {
        const agent = AGENTS[name];
        const agentPath = join(copilotAgentsDir, `${name}.agent.md`);
        if (existsSync(agentPath)) {
          const content = readFileSync(agentPath, 'utf-8');
          const descPresent = content.includes(agent.description);
          const bodyPresent = content.includes(agent.bodySnippet);
          lines.push(`  - **${name}**: ✓ present`);
          lines.push(`    - description  : ${descPresent ? agent.description : '✗ MISSING'}`);
          lines.push(`    - body snippet : ${bodyPresent ? '✓ present' : '✗ MISSING'}`);
        } else {
          lines.push(`  - **${name}**: ✗ file not found`);
        }
      }
    } else {
      lines.push('  - (agents directory not found)');
    }

    // ── EMBEDDED TARGETS (projected into skills) ───────────────────────────
    lines.push(`\n## Embedded agent targets (agents projected into skills)\n`);
    for (const target of EMBEDDED_TARGETS) {
      const r = await runCli(`generate --targets ${target}`, manifestDir);
      expect(r.exitCode, r.stderr).toBe(0);
      lines.push(`### ${target}: exit=${r.exitCode}\n`);
      for (const name of AGENT_NAMES) {
        const projectedPath = projectedAgentSkillPath(target, name);
        const absoluteProjectedPath = join(manifestDir, projectedPath);
        if (existsSync(absoluteProjectedPath)) {
          const fm = parseFm(absoluteProjectedPath);
          lines.push(`  - **${name}**: ✓ projected to \`${projectedPath}\``);
          lines.push(`    - description : ${fm.description ?? '(none)'}`);
          lines.push(`    - model       : ${fm['x-agentsbridge-model'] ?? '(none)'}`);
          lines.push(`    - tools       : ${toStringArray(fm['x-agentsbridge-tools']).join(', ')}`);
        } else {
          lines.push(`  - **${name}**: ✗ projected skill not found`);
        }
      }
    }

    // ── NATIVE AGENT TARGETS (.codex/agents/*.toml, .gemini/agents/*.md) ───
    lines.push(`\n## Native agent targets\n`);
    for (const target of [...NATIVE_AGENT_TOML_TARGETS, ...NATIVE_AGENT_MD_TARGETS]) {
      const r = await runCli(`generate --targets ${target}`, manifestDir);
      expect(r.exitCode, r.stderr).toBe(0);
      const ext = target === 'codex-cli' ? '.toml' : '.md';
      const agentDir = join(manifestDir, target === 'codex-cli' ? '.codex' : '.gemini', 'agents');
      lines.push(`### ${target}: exit=${r.exitCode}\n`);
      if (existsSync(agentDir)) {
        for (const name of AGENT_NAMES) {
          const agentPath = join(agentDir, `${name}${ext}`);
          if (existsSync(agentPath)) {
            const content = readFileSync(agentPath, 'utf-8');
            const agent = AGENTS[name];
            lines.push(`  - **${name}**: ✓ \`${relative(manifestDir, agentPath)}\``);
            lines.push(`    - description : ${content.includes(agent.description) ? '✓' : '✗'}`);
            lines.push(`    - body snippet: ${content.includes(agent.bodySnippet) ? '✓' : '✗'}`);
          } else {
            lines.push(`  - **${name}**: ✗ not found`);
          }
        }
      } else {
        lines.push('  - (agents directory not found)');
      }
    }

    // ── WRITE REPORT ──────────────────────────────────────────────────────
    const report = lines.join('\n');
    writeFileSync(REPORT_PATH, report, 'utf-8');
    console.log(`\nReport written to ${relative(process.cwd(), REPORT_PATH)}`);
  });
});
