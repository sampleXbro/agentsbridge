/**
 * Branch coverage for src/canonical/features/agents.ts:
 * - skip when readFileSafe returns empty content (line 80).
 * - skip when frontmatter parse fails (line 82 via parseOrSkipFrontmatter).
 * - mcpServers kebab-case fallback (line 94).
 * - disallowedTools kebab-case fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseAgents } from '../../../src/canonical/features/agents.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-agents-feats-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('parseAgents — branch coverage', () => {
  it('skips empty files', async () => {
    writeFileSync(join(dir, 'empty.md'), '');
    writeFileSync(join(dir, 'good.md'), '---\ndescription: ok\n---\nbody');
    const agents = await parseAgents(dir);
    expect(agents.map((a) => a.name)).toEqual(['good']);
  });

  it('skips files with unparseable frontmatter', async () => {
    writeFileSync(
      join(dir, 'broken.md'),
      '---\nbad: : invalid: yaml: nested: ::::\n  - mixed\n---\nbody',
    );
    writeFileSync(join(dir, 'good.md'), '---\ndescription: ok\n---\nbody');
    const agents = await parseAgents(dir, { onParseError: () => {} });
    expect(agents.find((a) => a.name === 'good')).toBeDefined();
  });

  it('falls back to kebab-case `mcp-servers` and `disallowed-tools` when camelCase absent', async () => {
    writeFileSync(
      join(dir, 'agent.md'),
      '---\ndescription: x\nmcp-servers:\n  - srv-a\ndisallowed-tools:\n  - Bash\n---\nbody',
    );
    const agents = await parseAgents(dir);
    expect(agents[0]!.mcpServers).toEqual(['srv-a']);
    expect(agents[0]!.disallowedTools).toEqual(['Bash']);
  });

  it('uses maxTurns kebab fallback when camelCase missing', async () => {
    writeFileSync(join(dir, 'agent.md'), '---\ndescription: x\nmax-turns: 7\n---\nbody');
    const agents = await parseAgents(dir);
    expect(agents[0]!.maxTurns).toBe(7);
  });

  it('uses tools kebab fallback when both keys present (camel wins via length check)', async () => {
    writeFileSync(
      join(dir, 'agent.md'),
      '---\ndescription: x\ntools:\n  - Read\n  - Write\n---\nbody',
    );
    const agents = await parseAgents(dir);
    expect(agents[0]!.tools).toEqual(['Read', 'Write']);
  });

  it('returns [] when agents/ dir is missing', async () => {
    const agents = await parseAgents(join(dir, 'no-agents'));
    expect(agents).toEqual([]);
  });
});
