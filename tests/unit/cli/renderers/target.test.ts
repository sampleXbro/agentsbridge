import { describe, expect, it } from 'vitest';
import { renderTarget } from '../../../../src/cli/renderers/target.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderTarget', () => {
  const output = useCapturedOutput();

  it('prints error and help when help is requested', () => {
    renderTarget({
      exitCode: 2,
      error: 'Unknown target subcommand: nope',
      showHelp: true,
      data: { id: '', written: [], skipped: [], postSteps: [] },
    });

    expect(output.stderr()).toContain('Unknown target subcommand: nope');
    expect(output.stdout()).toContain('Usage: agentsmesh target');
    expect(output.stdout()).toContain('scaffold <id>');
  });

  it('prints created files and next steps when files were written', () => {
    renderTarget({
      exitCode: 0,
      data: {
        id: 'acme',
        written: ['src/targets/acme/constants.ts'],
        skipped: [],
        postSteps: ['Run pnpm catalog:generate'],
      },
    });

    expect(output.stdout()).toContain('created src/targets/acme/constants.ts');
    expect(output.stdout()).toContain('Next steps:');
    expect(output.stdout()).toContain('Run pnpm catalog:generate');
  });

  it('prints skipped files without next steps when nothing was written', () => {
    renderTarget({
      exitCode: 0,
      data: {
        id: 'acme',
        written: [],
        skipped: ['src/targets/acme/constants.ts'],
        postSteps: ['Run pnpm catalog:generate'],
      },
    });

    expect(output.stderr()).toContain('skipped src/targets/acme/constants.ts');
    expect(output.stderr()).toContain('already exists');
    expect(output.stdout()).not.toContain('Next steps:');
  });

  it('emits nothing when there are no written or skipped files', () => {
    renderTarget({
      exitCode: 0,
      data: { id: 'empty', written: [], skipped: [], postSteps: ['Run later'] },
    });

    expect(output.stdout()).toBe('');
    expect(output.stderr()).toBe('');
  });
});
