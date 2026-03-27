import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseAgents } from '../../../src/canonical/features/agents.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-agents-test');
const AGENTS_DIR = join(TEST_DIR, '.agentsmesh', 'agents');

beforeEach(() => {
  mkdirSync(AGENTS_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeAgent(filename: string, content: string): void {
  writeFileSync(join(AGENTS_DIR, filename), content);
}

describe('parseAgents', () => {
  it('parses single agent with frontmatter', async () => {
    writeAgent(
      'reviewer.md',
      `---
description: Code review specialist
tools: Read, Grep, Glob, Bash(git diff)
model: claude-sonnet-4
permission-mode: ask
max-turns: 10
---

Review the current changes and suggest improvements.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      source: expect.stringContaining('reviewer.md'),
      name: 'reviewer',
      description: 'Code review specialist',
      tools: ['Read', 'Grep', 'Glob', 'Bash(git diff)'],
      disallowedTools: [],
      model: 'claude-sonnet-4',
      permissionMode: 'ask',
      maxTurns: 10,
      mcpServers: [],
      skills: [],
      memory: '',
      body: expect.stringContaining('Review the current changes'),
    });
  });

  it('derives agent name from filename', async () => {
    writeAgent(
      'deployer.md',
      `---
description: Deploy agent
---
Deploy steps.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.name).toBe('deployer');
  });

  it('parses tools as YAML array', async () => {
    writeAgent(
      'fixer.md',
      `---
description: Auto-fix
tools: [Read, Write, Grep]
---
Fix issues.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.tools).toEqual(['Read', 'Write', 'Grep']);
  });

  it('handles disallowed-tools (kebab and camel)', async () => {
    writeAgent(
      'safe.md',
      `---
description: Safe mode
disallowed-tools: Write, Bash
tools: Read, Grep
---
Read only.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.disallowedTools).toEqual(['Write', 'Bash']);
  });

  it('parses disallowedTools as array', async () => {
    writeAgent(
      'readonly.md',
      `---
description: Read only
disallowedTools: [Write, Bash, Glob]
---
Read.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.disallowedTools).toEqual(['Write', 'Bash', 'Glob']);
  });

  it('parses mcpServers (kebab and camel)', async () => {
    writeAgent(
      'mcp-agent.md',
      `---
description: Uses MCP
mcp-servers: filesystem, github
---
Use tools.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.mcpServers).toEqual(['filesystem', 'github']);
  });

  it('parses skills and memory', async () => {
    writeAgent(
      'skilled.md',
      `---
description: Skilled agent
skills: typescript-pro, post-feature-qa
memory: .agents/memory.md
---
Expert.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.skills).toEqual(['typescript-pro', 'post-feature-qa']);
    expect(agents[0]?.memory).toBe('.agents/memory.md');
  });

  it('parses nested hooks', async () => {
    writeAgent(
      'hooked.md',
      `---
name: reviewer
description: With hooks
hooks:
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "prettier --write"
---
System prompt.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.hooks).toBeDefined();
    expect(agents[0]?.hooks.PostToolUse).toBeInstanceOf(Array);
    expect((agents[0]?.hooks.PostToolUse as unknown[])[0]).toMatchObject({
      matcher: 'Write',
    });
  });

  it('parses maxTurns (kebab and camel)', async () => {
    writeAgent(
      'limited.md',
      `---
description: Limited turns
max-turns: 5
---
Body.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.maxTurns).toBe(5);
  });

  it('parses multiple agents', async () => {
    writeAgent(
      'reviewer.md',
      `---
description: Review
tools: Read
---
Review body.`,
    );
    writeAgent(
      'deployer.md',
      `---
description: Deploy
---
Deploy body.`,
    );
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents).toHaveLength(2);
    const reviewer = agents.find((a) => a.name === 'reviewer');
    const deployer = agents.find((a) => a.name === 'deployer');
    expect(reviewer?.body).toContain('Review body');
    expect(deployer?.body).toContain('Deploy body');
  });

  it('parses maxTurns as string (e.g., "5")', async () => {
    writeAgent('str-turns.md', `---\ndescription: Agent\nmaxTurns: "5"\n---\n\nBody.`);
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.maxTurns).toBe(5);
  });

  it('handles negative string maxTurns (falls back to 0)', async () => {
    writeAgent('neg-turns.md', `---\ndescription: Agent\nmaxTurns: "-1"\n---\n\nBody.`);
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.maxTurns).toBe(0);
  });

  it('handles non-numeric maxTurns (falls back to 0)', async () => {
    writeAgent('nan-turns.md', `---\ndescription: Agent\nmaxTurns: "abc"\n---\n\nBody.`);
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents[0]?.maxTurns).toBe(0);
  });

  it('returns empty array for non-existent directory', async () => {
    const agents = await parseAgents(join(TEST_DIR, 'nope'));
    expect(agents).toEqual([]);
  });

  it('returns empty array for empty agents directory', async () => {
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents).toEqual([]);
  });

  it('uses defaults when frontmatter minimal', async () => {
    writeAgent('minimal.md', `# Just body`);
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      name: 'minimal',
      description: '',
      tools: [],
      disallowedTools: [],
      model: '',
      permissionMode: '',
      maxTurns: 0,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
      body: expect.stringContaining('Just body'),
    });
  });

  it('ignores non-.md files', async () => {
    writeAgent(
      'reviewer.md',
      `---
description: Review
---
Body`,
    );
    writeFileSync(join(AGENTS_DIR, 'readme.txt'), 'not an agent');
    const agents = await parseAgents(AGENTS_DIR);
    expect(agents).toHaveLength(1);
  });
});
