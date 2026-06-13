import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inferCopilotPickFromPath } from '../../../../src/install/native/native-path-pick-infer-copilot.js';

const ROOT = join(tmpdir(), 'am-copilot-pick-infer');

function write(rel: string, body = '# x'): void {
  const full = join(ROOT, ...rel.split('/'));
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('inferCopilotPickFromPath', () => {
  it('maps .github/prompts/*.prompt.md to commands', async () => {
    write('.github/prompts/deploy.prompt.md');
    write('.github/prompts/review.prompt.md');
    write('.github/prompts/ignored.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/prompts')).toEqual({
      commands: ['deploy', 'review'],
    });
  });

  it('returns {} for empty prompts dir', async () => {
    mkdirSync(join(ROOT, '.github', 'prompts'), { recursive: true });
    expect(await inferCopilotPickFromPath(ROOT, '.github/prompts')).toEqual({});
  });

  it('maps .github/copilot/*.instructions.md to rules, excluding copilot-instructions.md', async () => {
    write('.github/copilot/style.instructions.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/copilot')).toEqual({ rules: ['style'] });
  });

  it('does not treat the .github/copilot-instructions.md root file as a rules dir', async () => {
    write('.github/copilot-instructions.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/copilot-instructions.md')).toEqual({});
  });

  it('maps .github/instructions/*.instructions.md and plain *.md to rules', async () => {
    write('.github/instructions/scoped.instructions.md');
    write('.github/instructions/plain.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/instructions')).toEqual({
      rules: ['plain', 'scoped'],
    });
  });

  it('maps .github/skills skill tree to skills', async () => {
    write('.github/skills/research/SKILL.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/skills')).toEqual({ skills: ['research'] });
  });

  it('maps .github/agents/*.agent.md to agents', async () => {
    write('.github/agents/planner.agent.md');
    expect(await inferCopilotPickFromPath(ROOT, '.github/agents')).toEqual({ agents: ['planner'] });
  });

  it('returns {} for an unrelated path', async () => {
    write('.github/workflows/ci.yml', 'on: push');
    expect(await inferCopilotPickFromPath(ROOT, '.github/workflows')).toEqual({});
  });

  it('returns {} when instructions dir has no matching files', async () => {
    mkdirSync(join(ROOT, '.github', 'instructions'), { recursive: true });
    expect(await inferCopilotPickFromPath(ROOT, '.github/instructions')).toEqual({});
  });

  it('returns {} when agents dir has no .agent.md files', async () => {
    write('.github/agents/notes.txt', 'x');
    expect(await inferCopilotPickFromPath(ROOT, '.github/agents')).toEqual({});
  });
});
