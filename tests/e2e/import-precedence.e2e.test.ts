import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { readText } from './helpers/assertions.js';

describe('import precedence e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('prefers Codex AGENTS.md over codex.md and strips generated rule indexes', async () => {
    dir = createTestProject();
    writeFileSync(
      join(dir, 'AGENTS.md'),
      [
        '# Preferred root',
        '',
        '<!-- agentsmesh:codex-rule-index:start -->',
        '## Additional Rule Files',
        '- [TypeScript](.codex/instructions/typescript.md): Applies to `src/**`.',
        '<!-- agentsmesh:codex-rule-index:end -->',
        '',
        'Keep the preferred root body.',
      ].join('\n'),
    );
    writeFileSync(join(dir, 'codex.md'), '# Legacy fallback root\n');

    const result = await runCli('import --from codex-cli', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const root = readText(join(dir, '.agentsmesh', 'rules', '_root.md'));
    expect(root).toContain('Preferred root');
    expect(root).toContain('Keep the preferred root body.');
    expect(root).not.toContain('Additional Rule Files');
    expect(root).not.toContain('agentsmesh:codex-rule-index');
    expect(root).not.toContain('Legacy fallback root');
  });

  it('prefers Cursor structured general.mdc over AGENTS.md fallback when both coexist', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    writeFileSync(join(dir, 'AGENTS.md'), '# Cursor fallback root\n');
    writeFileSync(
      join(dir, '.cursor', 'rules', 'general.mdc'),
      '---\nalwaysApply: true\ndescription: Structured root\n---\n\n# Cursor preferred root\n',
    );

    const result = await runCli('import --from cursor', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const root = readText(join(dir, '.agentsmesh', 'rules', '_root.md'));
    expect(root).toContain('Cursor preferred root');
    expect(root).toContain('description: Structured root');
    expect(root).not.toContain('Cursor fallback root');
  });

  it('prefers Windsurf primary files over fallback mirrors when both coexist', async () => {
    dir = createTestProject();
    writeFileSync(join(dir, '.windsurfrules'), '# Primary Windsurf root\n');
    writeFileSync(join(dir, 'AGENTS.md'), '# Fallback Windsurf root\n');
    writeFileSync(join(dir, '.windsurfignore'), 'primary-ignore\n');
    writeFileSync(join(dir, '.codeiumignore'), 'fallback-ignore\n');

    const result = await runCli('import --from windsurf', dir);
    expect(result.exitCode, result.stderr).toBe(0);

    const root = readText(join(dir, '.agentsmesh', 'rules', '_root.md'));
    expect(root).toContain('Primary Windsurf root');
    expect(root).not.toContain('Fallback Windsurf root');
    expect(readText(join(dir, '.agentsmesh', 'ignore'))).toContain('primary-ignore');
    expect(readText(join(dir, '.agentsmesh', 'ignore'))).not.toContain('fallback-ignore');
  });
});
