import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveInstallConflicts } from '../../../src/install/core/install-conflicts.js';
import * as prompts from '../../../src/install/core/prompts.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

vi.mock('../../../src/install/core/prompts.js', () => ({
  confirm: vi.fn(),
}));

describe('resolveInstallConflicts', () => {
  beforeEach(() => {
    vi.mocked(prompts.confirm).mockReset();
  });

  const emptyMerged = (): CanonicalFiles => ({
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  });

  it('does not prompt when merged has no collisions', async () => {
    const skill = {
      source: '/x/SKILL.md',
      name: 'new',
      description: 'd',
      body: '',
      supportingFiles: [],
    };
    const sel = await resolveInstallConflicts(emptyMerged(), {
      skills: [skill],
      rules: [],
      commands: [],
      agents: [],
    });
    expect(sel.skillNames).toEqual(['new']);
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it('drops skill when user declines duplicate', async () => {
    vi.mocked(prompts.confirm).mockResolvedValue(false);
    const skill = {
      source: '/x/SKILL.md',
      name: 'dup',
      description: 'd',
      body: '',
      supportingFiles: [],
    };
    const merged = emptyMerged();
    merged.skills = [{ ...skill }];
    const sel = await resolveInstallConflicts(merged, {
      skills: [skill],
      rules: [],
      commands: [],
      agents: [],
    });
    expect(sel.skillNames).toEqual([]);
    expect(prompts.confirm).toHaveBeenCalledOnce();
  });

  it('keeps skill when user accepts duplicate', async () => {
    vi.mocked(prompts.confirm).mockResolvedValue(true);
    const skill = {
      source: '/x/SKILL.md',
      name: 'dup',
      description: 'd',
      body: '',
      supportingFiles: [],
    };
    const merged = emptyMerged();
    merged.skills = [{ ...skill }];
    const sel = await resolveInstallConflicts(merged, {
      skills: [skill],
      rules: [],
      commands: [],
      agents: [],
    });
    expect(sel.skillNames).toEqual(['dup']);
  });

  it('drops rule slug when declined', async () => {
    vi.mocked(prompts.confirm).mockResolvedValue(false);
    const rule = {
      source: '/p/rules/r.md',
      root: false,
      targets: [] as string[],
      description: 'd',
      globs: [] as string[],
      body: '',
    };
    const merged = emptyMerged();
    merged.rules = [{ ...rule }];
    const sel = await resolveInstallConflicts(merged, {
      skills: [],
      rules: [rule],
      commands: [],
      agents: [],
    });
    expect(sel.ruleSlugs).toEqual([]);
  });

  it('handles command and agent duplicates independently', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const command = {
      source: '/commands/review.md',
      name: 'review',
      description: 'd',
      allowedTools: [],
      body: '',
    };
    const agent = {
      source: '/agents/reviewer.md',
      name: 'reviewer',
      description: 'd',
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
    const merged = emptyMerged();
    merged.commands = [{ ...command }];
    merged.agents = [{ ...agent }];

    const sel = await resolveInstallConflicts(merged, {
      skills: [],
      rules: [],
      commands: [command],
      agents: [agent],
    });

    expect(sel.commandNames).toEqual([]);
    expect(sel.agentNames).toEqual(['reviewer']);
    expect(prompts.confirm).toHaveBeenCalledTimes(2);
  });
});
