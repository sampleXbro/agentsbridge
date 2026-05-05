import { describe, expect, it } from 'vitest';
import { renderImport } from '../../../../src/cli/renderers/import.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderImport', () => {
  const output = useCapturedOutput();

  it('prints nothing-to-import with the target name', () => {
    renderImport({
      exitCode: 0,
      data: { scope: 'project', target: 'cursor', files: [] },
    });

    expect(output.stdout()).toContain('Nothing to import from cursor.');
  });

  it('prints file mappings and project generate guidance', () => {
    renderImport({
      exitCode: 0,
      data: {
        scope: 'project',
        target: 'claude-code',
        files: [{ from: '.claude/CLAUDE.md', to: '.agentsmesh/rules/_root.md' }],
      },
    });

    expect(output.stdout()).toContain('.claude/CLAUDE.md');
    expect(output.stdout()).toContain('.agentsmesh/rules/_root.md');
    expect(output.stdout()).toContain("Run 'agentsmesh generate' to sync");
  });

  it('prints global generate guidance for global imports', () => {
    renderImport({
      exitCode: 0,
      data: {
        scope: 'global',
        target: 'codex-cli',
        files: [{ from: '.codex/AGENTS.md', to: '.agentsmesh/rules/_root.md' }],
      },
    });

    expect(output.stdout()).toContain("Run 'agentsmesh generate --global' to sync");
  });
});
