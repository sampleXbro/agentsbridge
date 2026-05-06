import { describe, expect, it } from 'vitest';
import { renderMatrix } from '../../../../src/cli/renderers/matrix.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderMatrix', () => {
  const output = useCapturedOutput();

  it('prints an empty-feature hint', () => {
    renderMatrix({
      exitCode: 0,
      data: { targets: ['cursor'], features: [] },
    });

    expect(output.stdout()).toContain('No features enabled.');
  });

  it('prints the support matrix and verbose details when requested', () => {
    renderMatrix(
      {
        exitCode: 0,
        data: {
          targets: ['cursor'],
          features: [{ name: 'rules', support: { cursor: 'native' } }],
        },
        verboseDetails: 'cursor supports native rules',
      },
      { verbose: true },
    );

    expect(output.stdout()).toContain('Feature');
    expect(output.stdout()).toContain('rules');
    expect(output.stdout()).toContain('cursor supports native rules');
  });

  it('omits verbose details when disabled or unavailable', () => {
    renderMatrix(
      {
        exitCode: 0,
        data: {
          targets: ['cursor'],
          features: [{ name: 'rules', support: { cursor: 'native' } }],
        },
        verboseDetails: 'hidden details',
      },
      { verbose: false },
    );
    renderMatrix(
      {
        exitCode: 0,
        data: {
          targets: ['cursor'],
          features: [{ name: 'commands', support: { cursor: 'embedded' } }],
        },
      },
      { verbose: true },
    );

    expect(output.stdout()).not.toContain('hidden details');
  });
});
