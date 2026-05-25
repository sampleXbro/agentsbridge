import { describe, it, expect } from 'vitest';
import {
  runModifiedFilesPrompt,
  type ModifiedFilesPromptInput,
} from '../../../../src/install/prompts/modified-files-prompt.js';
import type { PromptAdapter } from '../../../../src/install/prompts/prompt-types.js';

interface Recorder {
  readonly prompts: string[];
  readonly writes: string[];
  readonly adapter: PromptAdapter;
}

function makeRecorder(answers: readonly string[]): Recorder {
  const prompts: string[] = [];
  const writes: string[] = [];
  let i = 0;
  const ask = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    if (i >= answers.length) return '';
    return answers[i++]!;
  };
  const write = (chunk: string): void => {
    writes.push(chunk);
  };
  return { prompts, writes, adapter: { ask, write } };
}

const TWO_MODS: ModifiedFilesPromptInput = {
  packName: 'addyosmani-agent-skills',
  modifications: [
    { relativePath: 'skills/interview-me/SKILL.md', status: 'modified' },
    { relativePath: 'agents/code-reviewer.md', status: 'modified' },
  ],
};

const MIXED_MODS: ModifiedFilesPromptInput = {
  packName: 'mixed-pack',
  modifications: [
    { relativePath: 'rules/_root.md', status: 'deleted' },
    { relativePath: 'skills/demo/SKILL.md', status: 'modified' },
    { relativePath: 'skills/demo/extra.md', status: 'added' },
  ],
};

describe('runModifiedFilesPrompt - empty input', () => {
  it('returns action=proceed immediately when there are no modifications', async () => {
    const r = makeRecorder([]);
    const result = await runModifiedFilesPrompt(
      { packName: 'foo', modifications: [] },
      { bypass: false },
      r.adapter,
    );
    expect(result).toEqual({ action: 'proceed' });
    expect(r.prompts).toEqual([]);
    expect(r.writes).toEqual([]);
  });
});

describe('runModifiedFilesPrompt - bypass / non-interactive (--force)', () => {
  it('defaults to delete-anyway and writes a banner', async () => {
    const r = makeRecorder([]);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: true }, r.adapter);

    expect(result).toEqual({ action: 'delete-anyway' });
    expect(r.prompts).toEqual([]);
    const combined = r.writes.join('');
    expect(combined).toContain('addyosmani-agent-skills');
    expect(combined).toContain('skills/interview-me/SKILL.md');
    expect(combined).toContain('agents/code-reviewer.md');
  });

  it('mentions the modification statuses on the banner under bypass', async () => {
    const r = makeRecorder([]);
    await runModifiedFilesPrompt(MIXED_MODS, { bypass: true }, r.adapter);
    const combined = r.writes.join('');
    expect(combined).toContain('rules/_root.md');
    expect(combined).toContain('deleted');
    expect(combined).toContain('skills/demo/SKILL.md');
    expect(combined).toContain('modified');
    expect(combined).toContain('skills/demo/extra.md');
    expect(combined).toContain('added');
  });
});

describe('runModifiedFilesPrompt - interactive', () => {
  it("user 'd' returns delete-anyway", async () => {
    const r = makeRecorder(['d']);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(result).toEqual({ action: 'delete-anyway' });
    expect(r.prompts).toHaveLength(1);
  });

  it("user 'k' returns keep-modified", async () => {
    const r = makeRecorder(['k']);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(result).toEqual({ action: 'keep-modified' });
  });

  it("user 'a' returns abort", async () => {
    const r = makeRecorder(['a']);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(result).toEqual({ action: 'abort' });
  });

  it('treats answers case-insensitively (D/K/A)', async () => {
    const r1 = makeRecorder(['D']);
    expect(await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r1.adapter)).toEqual({
      action: 'delete-anyway',
    });

    const r2 = makeRecorder(['K']);
    expect(await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r2.adapter)).toEqual({
      action: 'keep-modified',
    });

    const r3 = makeRecorder(['A']);
    expect(await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r3.adapter)).toEqual({
      action: 'abort',
    });
  });

  it('blank input aborts the run', async () => {
    const r = makeRecorder(['']);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(result).toEqual({ action: 'abort' });
  });

  it('unknown input aborts the run', async () => {
    const r = makeRecorder(['z']);
    const result = await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(result).toEqual({ action: 'abort' });
  });

  it('writes a banner containing the pack name and every modified path before asking', async () => {
    const r = makeRecorder(['d']);
    await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    const combined = r.writes.join('');
    expect(combined).toContain('addyosmani-agent-skills');
    expect(combined).toContain('skills/interview-me/SKILL.md');
    expect(combined).toContain('agents/code-reviewer.md');
  });

  it('prompt text exposes the three actions [d]/[k]/[a]', async () => {
    const r = makeRecorder(['d']);
    await runModifiedFilesPrompt(TWO_MODS, { bypass: false }, r.adapter);
    expect(r.prompts).toHaveLength(1);
    const prompt = r.prompts[0]!.toLowerCase();
    expect(prompt).toContain('[d]');
    expect(prompt).toContain('[k]');
    expect(prompt).toContain('[a]');
  });
});
