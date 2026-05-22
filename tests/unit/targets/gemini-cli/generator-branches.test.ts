/**
 * Branch coverage for src/targets/gemini-cli/generator/{agents,commands,skills,ignore}.ts.
 * Targets the empty/fallback branches that aren't reached by happy-path fixtures.
 */

import { describe, it, expect } from 'vitest';
import { generateAgents } from '../../../../src/targets/gemini-cli/generator/agents.js';
import { generateCommands } from '../../../../src/targets/gemini-cli/generator/commands.js';
import { generateSkills } from '../../../../src/targets/gemini-cli/generator/skills.js';
import { generateIgnore } from '../../../../src/targets/gemini-cli/generator/ignore.js';
import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalSkill,
} from '../../../../src/core/types.js';

function baseCanonical(): CanonicalFiles {
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

describe('gemini-cli generators — edge branches', () => {
  it('generateAgents emits no description / tools / model / maxTurns when fields are empty', () => {
    const agent: CanonicalAgent = {
      source: '/x',
      name: 'a',
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
      body: '',
    };
    const outputs = generateAgents({ ...baseCanonical(), agents: [agent] });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.content).not.toContain('description:');
    expect(outputs[0]!.content).not.toContain('tools:');
    expect(outputs[0]!.content).not.toContain('model:');
    expect(outputs[0]!.content).not.toContain('maxTurns:');
    expect(outputs[0]!.content).toContain('name: a');
  });

  it('generateCommands escapes prompt with embedded triple-quote via JSON.stringify branch', () => {
    const cmd: CanonicalCommand = {
      source: '/x',
      name: 'cmd',
      description: 'desc',
      argumentHint: '',
      allowedTools: [],
      body: 'has """ embedded',
    };
    const outputs = generateCommands({ ...baseCanonical(), commands: [cmd] });
    expect(outputs).toHaveLength(1);
    // Must escape using JSON.stringify rather than triple-quoted literal.
    expect(outputs[0]!.content).toContain('prompt = "has \\"\\"\\" embedded"');
  });

  it('generateCommands falls back to cmd.name when description is empty (line 16 ternary)', () => {
    const cmd: CanonicalCommand = {
      source: '/x',
      name: 'build',
      description: '',
      argumentHint: '',
      allowedTools: [],
      body: 'do build',
    };
    const outputs = generateCommands({ ...baseCanonical(), commands: [cmd] });
    expect(outputs[0]!.content).toContain('description = "build"');
  });

  it('generateCommands emits empty prompt body when body is whitespace-only (line 17 fallback)', () => {
    const cmd: CanonicalCommand = {
      source: '/x',
      name: 'empty',
      description: 'desc',
      argumentHint: '',
      allowedTools: [],
      body: '   \n  ',
    };
    const outputs = generateCommands({ ...baseCanonical(), commands: [cmd] });
    // Empty literal between """ markers.
    expect(outputs[0]!.content).toContain('prompt = """');
    expect(outputs[0]!.content).toMatch(/prompt = """\n\n"""/);
  });

  it('generateSkills emits supporting files alongside SKILL.md and skips empty description', () => {
    const skill: CanonicalSkill = {
      source: '/x',
      name: 'demo',
      description: '',
      body: '',
      supportingFiles: [{ relativePath: 'refs\\notes.md', content: 'notes-content' }],
    };
    const outputs = generateSkills({ ...baseCanonical(), skills: [skill] });
    expect(outputs.map((o) => o.path)).toEqual([
      '.gemini/skills/demo/SKILL.md',
      '.gemini/skills/demo/refs/notes.md',
    ]);
    // No description line when description is empty.
    expect(outputs[0]!.content).not.toContain('description:');
  });

  it('generateIgnore returns no outputs when canonical.ignore is empty', () => {
    expect(generateIgnore(baseCanonical())).toEqual([]);
  });
});
