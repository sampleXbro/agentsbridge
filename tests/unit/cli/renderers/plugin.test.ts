import { describe, expect, it } from 'vitest';
import { renderPlugin } from '../../../../src/cli/renderers/plugin.js';
import type { PluginCommandResult } from '../../../../src/cli/commands/plugin.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderPlugin', () => {
  const output = useCapturedOutput();

  it('prints error and help when help is requested', () => {
    renderPlugin({
      exitCode: 2,
      error: 'Unknown plugin subcommand: nope',
      showHelp: true,
      data: { subcommand: 'list', plugins: [] },
    });

    expect(output.stderr()).toContain('Unknown plugin subcommand: nope');
    expect(output.stdout()).toContain('Usage: agentsmesh plugin');
    expect(output.stdout()).toContain('Only install plugins from sources you trust.');
  });

  it('prints add instructions for latest and pinned plugin versions', () => {
    renderPlugin({
      exitCode: 0,
      data: {
        subcommand: 'add',
        id: 'acme',
        package: '@scope/acme',
        version: 'latest',
      },
    });
    renderPlugin({
      exitCode: 0,
      data: {
        subcommand: 'add',
        id: 'beta',
        package: 'beta-plugin',
        version: '2.0.0',
      },
    });

    expect(output.stdout()).toContain("Plugin 'acme' added to agentsmesh.yaml");
    expect(output.stdout()).toContain('Next: npm install @scope/acme@latest');
    expect(output.stdout()).toContain('Next: npm install beta-plugin@2.0.0');
    expect(output.stderr()).toContain('Plugins load as trusted Node.js modules');
  });

  it('prints empty and populated plugin lists', () => {
    renderPlugin({ exitCode: 0, data: { subcommand: 'list', plugins: [] } });
    renderPlugin({
      exitCode: 0,
      data: {
        subcommand: 'list',
        plugins: [
          {
            id: 'full',
            package: 'pkg-full',
            version: '1.0.0',
            status: 'ok',
            targets: 'alpha, beta',
          },
          { id: 'bare', package: 'pkg-bare' },
        ],
      },
    });

    expect(output.stdout()).toContain('No plugins configured.');
    expect(output.stdout()).toContain('Configured plugins:');
    expect(output.stdout()).toContain('full | pkg-full@1.0.0 | ok | alpha, beta');
    expect(output.stdout()).toContain('bare | pkg-bare |  |');
  });

  it('prints remove outcomes for found and missing plugins', () => {
    renderPlugin({ exitCode: 0, data: { subcommand: 'remove', id: 'old', found: true } });
    renderPlugin({ exitCode: 0, data: { subcommand: 'remove', id: 'ghost', found: false } });

    expect(output.stdout()).toContain("Plugin 'old' removed from agentsmesh.yaml");
    expect(output.stderr()).toContain("Plugin 'ghost' was not found in agentsmesh.yaml");
  });

  it('prints info error states for missing and unloadable plugins', () => {
    renderPlugin({
      exitCode: 1,
      data: { subcommand: 'info', id: 'missing', package: '', descriptors: [] },
    });
    renderPlugin({
      exitCode: 1,
      data: { subcommand: 'info', id: 'broken', package: 'broken-pkg', descriptors: [] },
    });

    expect(output.stderr()).toContain("Plugin 'missing' not found in agentsmesh.yaml");
    expect(output.stderr()).toContain("Failed to load plugin 'broken'");
  });

  it('prints info details with optional versions and descriptors', () => {
    const withVersion: PluginCommandResult = {
      exitCode: 0,
      data: {
        subcommand: 'info',
        id: 'full',
        package: 'pkg-full',
        version: '3.1.0',
        descriptors: [{ id: 'target-a', description: 'Target A' }],
      },
    };
    const withoutVersion: PluginCommandResult = {
      exitCode: 0,
      data: {
        subcommand: 'info',
        id: 'plain',
        package: 'pkg-plain',
        descriptors: [],
      },
    };

    renderPlugin(withVersion);
    renderPlugin(withoutVersion);

    expect(output.stdout()).toContain('Plugin: full');
    expect(output.stdout()).toContain('Source: pkg-full@3.1.0');
    expect(output.stdout()).toContain('Descriptors: 1');
    expect(output.stdout()).toContain('- target-a: Target A');
    expect(output.stdout()).toContain('Source: pkg-plain');
    expect(output.stdout()).toContain('Descriptors: 0');
  });
});
