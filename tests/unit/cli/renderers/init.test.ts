import { describe, expect, it } from 'vitest';
import { renderInit } from '../../../../src/cli/renderers/init.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderInit', () => {
  const output = useCapturedOutput();

  it('prints detected configs and the manual import hint when nothing was imported', () => {
    renderInit({
      exitCode: 0,
      data: {
        scope: 'project',
        configFile: 'agentsmesh.yaml',
        localConfigFile: 'agentsmesh.local.yaml',
        detectedConfigs: ['claude-code'],
        imported: [],
        importedToolCount: 0,
        scaffoldType: 'full',
        gitignoreUpdated: false,
      },
    });

    expect(output.stdout()).toContain('Found existing configurations: claude-code');
    expect(output.stdout()).toContain("Run 'agentsmesh init --yes' to auto-import");
    expect(output.stdout()).toContain('Created agentsmesh.yaml');
    expect(output.stdout()).not.toContain('Updated .gitignore');
  });

  it('prints auto-import mappings, target suffix, and gitignore update', () => {
    renderInit({
      exitCode: 0,
      data: {
        scope: 'project',
        configFile: 'agentsmesh.yaml',
        localConfigFile: 'agentsmesh.local.yaml',
        detectedConfigs: ['claude-code', 'cursor'],
        imported: [{ from: '.claude/CLAUDE.md', to: '.agentsmesh/rules/_root.md' }],
        importedToolCount: 2,
        scaffoldType: 'gap-fill',
        gitignoreUpdated: true,
      },
    });

    const stdout = output.stdout();
    expect(stdout).toContain('Auto-importing existing configurations (--yes)...');
    expect(stdout).toContain('.claude/CLAUDE.md');
    expect(stdout).toContain('.agentsmesh/rules/_root.md');
    expect(stdout).toContain('Imported 1 file(s) from 2 tool(s).');
    expect(stdout).toContain('Created agentsmesh.yaml (targets: claude-code, cursor)');
    expect(stdout).toContain('Created agentsmesh.local.yaml');
    expect(stdout).toContain('Updated .gitignore');
  });

  it('does not append target suffix when imports were not from detected configs', () => {
    renderInit({
      exitCode: 0,
      data: {
        scope: 'global',
        configFile: '.agentsmesh/agentsmesh.yaml',
        localConfigFile: '.agentsmesh/agentsmesh.local.yaml',
        detectedConfigs: [],
        imported: [{ from: '.cursor/rules/a.mdc', to: '.agentsmesh/rules/a.md' }],
        importedToolCount: 1,
        scaffoldType: 'none',
        gitignoreUpdated: false,
      },
    });

    expect(output.stdout()).toContain('Created .agentsmesh/agentsmesh.yaml\n');
    expect(output.stdout()).not.toContain('(targets:');
  });
});
