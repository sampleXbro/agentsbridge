import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInstall } from '../../src/install/run-install.js';

const ROOT = join(tmpdir(), 'ab-install-pack-integration');

describe('install pack (integration)', () => {
  beforeEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(join(ROOT, 'upstream', '.agentsbridge', 'skills', 'demo'), { recursive: true });
    mkdirSync(join(ROOT, 'project', '.agentsbridge', 'rules'), { recursive: true });

    writeFileSync(
      join(ROOT, 'upstream', '.agentsbridge', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo skill\n---\n# Demo\n',
    );
    writeFileSync(
      join(ROOT, 'upstream', '.agentsbridge', 'mcp.json'),
      JSON.stringify(
        { mcpServers: { context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } } },
        null,
        2,
      ),
    );
    writeFileSync(
      join(ROOT, 'upstream', '.agentsbridge', 'permissions.yaml'),
      'allow:\n  - Read\ndeny:\n  - Bash(rm:*)\n',
    );
    writeFileSync(
      join(ROOT, 'upstream', '.agentsbridge', 'hooks.yaml'),
      'PostToolUse:\n  - matcher: "*.ts"\n    command: prettier --write $FILE_PATH\n',
    );
    writeFileSync(join(ROOT, 'upstream', '.agentsbridge', 'ignore'), 'node_modules\ndist\n');

    writeFileSync(
      join(ROOT, 'project', 'agentsbridge.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules,skills,mcp,permissions,hooks,ignore]\nextends: []\n',
    );
    writeFileSync(
      join(ROOT, 'project', '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Root\n',
    );
  });

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('creates a pack, persists settings features, and generates target artifacts', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'shared-pack' }, [upstream], project);

    const packDir = join(project, '.agentsbridge', 'packs', 'shared-pack');
    expect(existsSync(join(packDir, 'skills', 'demo', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(packDir, 'mcp.json'))).toBe(true);
    expect(existsSync(join(packDir, 'permissions.yaml'))).toBe(true);
    expect(existsSync(join(packDir, 'hooks.yaml'))).toBe(true);
    expect(existsSync(join(packDir, 'ignore'))).toBe(true);

    expect(existsSync(join(project, '.claude', 'skills', 'demo', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(project, '.mcp.json'))).toBe(true);
    expect(existsSync(join(project, '.claude', 'settings.json'))).toBe(true);
    expect(existsSync(join(project, '.claudeignore'))).toBe(true);
  });

  it('updates the same pack on a second install instead of creating a duplicate pack', async () => {
    const project = join(ROOT, 'project');
    const upstream = join(ROOT, 'upstream');

    await runInstall({ force: true, name: 'shared-pack' }, [upstream], project);
    writeFileSync(
      join(ROOT, 'upstream', '.agentsbridge', 'ignore'),
      'node_modules\ndist\ncoverage\n',
    );

    await runInstall({ force: true, name: 'renamed-on-second-run' }, [upstream], project);

    const packsDir = join(project, '.agentsbridge', 'packs');
    expect(readdirSync(packsDir).sort()).toEqual(['shared-pack']);
    expect(readFileSync(join(packsDir, 'shared-pack', 'ignore'), 'utf-8')).toContain('coverage');
  });
});
