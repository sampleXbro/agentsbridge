/**
 * Branch coverage for src/targets/codex-cli/generator/mcp.ts and skills.ts:
 * - mcp empty / no stdio entries → no output.
 * - mcp server with env and special-char key (needsTomlQuoting).
 * - skills with empty description; with supporting files including Windows backslash paths.
 */

import { describe, it, expect } from 'vitest';
import { generateMcp } from '../../../../src/targets/codex-cli/generator/mcp.js';
import { generateSkills } from '../../../../src/targets/codex-cli/generator/skills.js';
import type { CanonicalFiles, CanonicalSkill } from '../../../../src/core/types.js';

function base(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('codex-cli generateMcp — branch coverage', () => {
  it('returns [] when canonical.mcp is null', () => {
    expect(generateMcp(base())).toEqual([]);
  });

  it('returns [] when mcpServers is empty', () => {
    expect(generateMcp({ ...base(), mcp: { mcpServers: {} } })).toEqual([]);
  });

  it('returns [] when no stdio servers (filters out url-type)', () => {
    const result = generateMcp({
      ...base(),
      mcp: {
        mcpServers: {
          web: { type: 'url', url: 'https://x', headers: {}, env: {} },
        },
      },
    });
    expect(result).toEqual([]);
  });

  it('emits TOML with quoted name containing special chars', () => {
    const result = generateMcp({
      ...base(),
      mcp: {
        mcpServers: {
          'fancy.name': {
            type: 'stdio',
            command: 'node',
            args: ['s.js'],
            env: { 'WEIRD KEY': 'value', NORMAL: 'v' },
          },
        },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toContain('[mcp_servers."fancy.name"]');
    expect(result[0]!.content).toContain('"WEIRD KEY"');
    expect(result[0]!.content).toMatch(/NORMAL = "v"/);
  });

  it('omits env line when env object is empty', () => {
    const result = generateMcp({
      ...base(),
      mcp: {
        mcpServers: {
          simple: { type: 'stdio', command: 'node', args: ['s.js'], env: {} },
        },
      },
    });
    expect(result[0]!.content).not.toContain('env =');
  });
});

describe('codex-cli generateSkills — branch coverage', () => {
  it('returns [] for empty canonical.skills', () => {
    expect(generateSkills(base())).toEqual([]);
  });

  it('omits description for skill with empty description', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 's',
      description: '',
      body: 'b',
      supportingFiles: [],
    };
    const outputs = generateSkills({ ...base(), skills: [skill] });
    expect(outputs[0]!.content).not.toContain('description:');
  });

  it('normalizes Windows backslash paths in supporting files to forward slashes', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 'demo',
      description: 'desc',
      body: 'body',
      supportingFiles: [{ relativePath: 'refs\\notes.md', content: 'n' }],
    };
    const outputs = generateSkills({ ...base(), skills: [skill] });
    expect(outputs.map((o) => o.path)).toContain('.agents/skills/demo/refs/notes.md');
  });
});
