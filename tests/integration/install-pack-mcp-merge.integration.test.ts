/**
 * Regression test: pack install must merge .agentsmesh/mcp.json per-key,
 * not replace the whole file. The seeded `agentsmesh` self-serve MCP server
 * entry from init/import must survive a pack install.
 *
 * Merge contract (from loadCanonicalWithExtends):
 *   extends → packs → local .agentsmesh/mcp.json
 * Local canonical is last, so user keys win on key collision.
 * Pack keys for new server names are preserved (accumulated).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run/run-install.js';

const ROOT = join(tmpdir(), 'am-install-pack-mcp-merge-integration');

// Canonical form after parseMcp normalizes stdio servers
const AGENTSMESH_SERVER_ENTRY_RAW = {
  command: 'npx',
  args: ['-y', 'agentsmesh', 'mcp'],
};

// parseMcp normalizes stdio servers: adds type='stdio' and env={}
const AGENTSMESH_SERVER_ENTRY_NORMALIZED = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', 'agentsmesh', 'mcp'],
  env: {},
};

describe('install pack: mcp.json merge contract (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });

    // Pack source: contains a 'foo' mcp server and a skill
    mkdirSync(join(ROOT, 'pack-source', '.agentsmesh', 'skills', 'pack-skill'), {
      recursive: true,
    });
    writeFileSync(
      join(ROOT, 'pack-source', '.agentsmesh', 'skills', 'pack-skill', 'SKILL.md'),
      '---\ndescription: Pack skill\n---\n# Pack Skill\n',
    );
    writeFileSync(
      join(ROOT, 'pack-source', '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            foo: { command: 'npx', args: ['-y', 'foo-mcp'] },
          },
        },
        null,
        2,
      ),
    );

    // Project: has agentsmesh.yaml and pre-existing .agentsmesh/mcp.json
    // with the seeded 'agentsmesh' self-serve MCP server entry
    mkdirSync(join(ROOT, 'project', '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(ROOT, 'project', 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules,skills,mcp]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            agentsmesh: AGENTSMESH_SERVER_ENTRY_RAW,
          },
        },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('preserves pre-existing agentsmesh server entry after pack install', async () => {
    const project = join(ROOT, 'project');
    const packSource = join(ROOT, 'pack-source');

    await runInstall({ force: true, name: 'test-pack' }, [packSource], project);

    // The generated .mcp.json for claude-code should contain BOTH entries
    const generatedMcp = JSON.parse(readFileSync(join(project, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };

    // Both server entries must be present
    expect(Object.keys(generatedMcp.mcpServers)).toContain('agentsmesh');
    expect(Object.keys(generatedMcp.mcpServers)).toContain('foo');

    // The agentsmesh entry must match the original exactly (normalized by parseMcp)
    expect(generatedMcp.mcpServers['agentsmesh']).toEqual(AGENTSMESH_SERVER_ENTRY_NORMALIZED);

    // The pack's foo entry must also be present
    expect(generatedMcp.mcpServers['foo']).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'foo-mcp'],
      env: {},
    });
  });

  it('user key wins on collision when pack and user define the same server name', async () => {
    const project = join(ROOT, 'project');
    const packSource = join(ROOT, 'pack-source');

    // Add a conflicting 'agentsmesh' entry in the pack source
    writeFileSync(
      join(ROOT, 'pack-source', '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            agentsmesh: { command: 'npx', args: ['-y', 'pack-override-agentsmesh'] },
            foo: { command: 'npx', args: ['-y', 'foo-mcp'] },
          },
        },
        null,
        2,
      ),
    );

    await runInstall({ force: true, name: 'test-pack' }, [packSource], project);

    const generatedMcp = JSON.parse(readFileSync(join(project, '.mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };

    // User's agentsmesh entry wins over pack's conflicting entry (local canonical is last in merge)
    expect(generatedMcp.mcpServers['agentsmesh']).toEqual(AGENTSMESH_SERVER_ENTRY_NORMALIZED);

    // Pack's non-conflicting entry is still accumulated
    expect(generatedMcp.mcpServers['foo']).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'foo-mcp'],
      env: {},
    });
  });
});
