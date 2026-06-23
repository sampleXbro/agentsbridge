// tests/unit/cli/prompts/clack-prompter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as clack from '@clack/prompts';
import { createClackPrompter } from '../../../../src/cli/prompts/clack-prompter.js';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  select: vi.fn().mockResolvedValue('picked'),
  multiselect: vi.fn().mockResolvedValue(['picked']),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}));

describe('createClackPrompter', () => {
  it('returns a Prompter exposing every required method', () => {
    const p = createClackPrompter();
    for (const m of [
      'intro',
      'outro',
      'note',
      'select',
      'multiselect',
      'isCancel',
      'cancel',
    ] as const) {
      expect(typeof p[m]).toBe('function');
    }
  });

  it('isCancel delegates to clack (plain values are not cancel)', () => {
    const p = createClackPrompter();
    expect(p.isCancel('claude-code')).toBe(false);
    expect(p.isCancel(['claude-code'])).toBe(false);
  });
});

describe('createClackPrompter wrappers delegate to @clack/prompts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('intro forwards the title to clack.intro', () => {
    createClackPrompter().intro('hi');
    expect(clack.intro).toHaveBeenCalledWith('hi');
  });

  it('outro forwards the message to clack.outro', () => {
    createClackPrompter().outro('bye');
    expect(clack.outro).toHaveBeenCalledWith('bye');
  });

  it('note forwards message and title to clack.note', () => {
    createClackPrompter().note('msg', 'Title');
    expect(clack.note).toHaveBeenCalledWith('msg', 'Title');
  });

  it('select maps options and resolves to the clack result', async () => {
    const result = await createClackPrompter().select({
      message: 'm',
      options: [{ value: 'a', label: 'A', hint: 'h' }],
      initialValue: 'a',
    });
    expect(result).toBe('picked');
    expect(clack.select).toHaveBeenCalledWith({
      message: 'm',
      options: [{ value: 'a', label: 'A', hint: 'h' }],
      initialValue: 'a',
    });
  });

  it('multiselect passes required:true and copies initialValues when provided', async () => {
    const result = await createClackPrompter().multiselect({
      message: 'm',
      options: [{ value: 'a', label: 'A', hint: 'h' }],
      initialValues: ['a'],
      required: true,
    });
    expect(result).toEqual(['picked']);
    expect(clack.multiselect).toHaveBeenCalledWith({
      message: 'm',
      options: [{ value: 'a', label: 'A', hint: 'h' }],
      initialValues: ['a'],
      required: true,
    });
  });

  it('multiselect defaults required to false and initialValues to undefined when absent', async () => {
    await createClackPrompter().multiselect({
      message: 'm',
      options: [{ value: 'a', label: 'A' }],
    });
    expect(clack.multiselect).toHaveBeenCalledTimes(1);
    const mock = vi.mocked(clack.multiselect);
    const arg = mock.mock.calls[0]?.[0];
    expect(arg?.required).toBe(false);
    expect(arg?.initialValues).toBeUndefined();
    expect(arg).toEqual({
      message: 'm',
      options: [{ value: 'a', label: 'A', hint: undefined }],
      initialValues: undefined,
      required: false,
    });
  });

  it('cancel forwards the message to clack.cancel', () => {
    createClackPrompter().cancel('cancelled');
    expect(clack.cancel).toHaveBeenCalledWith('cancelled');
  });
});
