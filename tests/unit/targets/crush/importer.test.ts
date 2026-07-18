import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCrush } from '../../../../src/targets/crush/importer.js';
import { toPosixPath } from '../../../helpers/posix-path.js';

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

describe('importFromCrush', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'crush-importer-test-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('imports root rule from CRUSH.md', async () => {
    await writeFile(
      join(projectRoot, 'CRUSH.md'),
      '# Project root\n\nUse strict TypeScript.',
      'utf-8',
    );

    const results = await importFromCrush(projectRoot);

    const rootRule = results.find((r) => r.toPath.includes('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromPath).toContain('CRUSH.md');
  });

  it('imports MCP servers from crush.json mcp key', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      $schema: 'https://charm.land/crush.json',
      mcp: {
        filesystem: {
          type: 'stdio',
          command: 'node',
          args: ['/path/to/server.js'],
        },
      },
    });

    const results = await importFromCrush(projectRoot);

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');

    // Verify the canonical mcp.json was written with mcpServers key
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    expect(parsed['mcpServers']).toHaveProperty('filesystem');
  });

  it('imports MCP servers from global ~/.config/crush/crush.json when scope=global', async () => {
    await mkdir(join(projectRoot, '.config', 'crush'), { recursive: true });
    await writeJson(join(projectRoot, '.config', 'crush', 'crush.json'), {
      $schema: 'https://charm.land/crush.json',
      mcp: { filesystem: { type: 'stdio', command: 'node', args: ['/path/to/server.js'] } },
    });

    const results = await importFromCrush(projectRoot, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.toPath).toBe('.agentsmesh/mcp.json');
    expect(toPosixPath(mcpResult!.fromPath)).toContain('.config/crush/crush.json');
    const { readFile } = await import('node:fs/promises');
    const parsed = JSON.parse(
      await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers).toHaveProperty('filesystem');
  });

  it('does not read project crush.json in global scope', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      mcp: { projectonly: { type: 'stdio', command: 'node', args: [] } },
    });

    const results = await importFromCrush(projectRoot, { scope: 'global' });
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('imports hooks from crush.json hooks key', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      hooks: {
        PreToolUse: [
          {
            matcher: '^bash$',
            command: '.crush/hooks/protect.sh',
            timeout: 10,
          },
        ],
      },
    });

    const results = await importFromCrush(projectRoot);

    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeDefined();
    expect(hooksResult!.toPath).toBe('.agentsmesh/hooks.yaml');
  });

  it('imports ignore patterns from .crushignore', async () => {
    await writeFile(join(projectRoot, '.crushignore'), 'node_modules/\ndist/\n*.log', 'utf-8');

    const results = await importFromCrush(projectRoot);

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.toPath).toBe('.agentsmesh/ignore');
  });

  it('imports skills from .crush/skills/', async () => {
    const skillDir = join(projectRoot, '.crush/skills/api-generator');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: api-generator\ndescription: Generate REST APIs\n---\n\n## Purpose\n\nGenerate endpoints.',
      'utf-8',
    );

    const results = await importFromCrush(projectRoot);

    const skillResult = results.find((r) => r.feature === 'skills');
    expect(skillResult).toBeDefined();
    expect(skillResult!.toPath).toContain('skills/api-generator');
  });

  it('returns empty results when no config exists', async () => {
    const results = await importFromCrush(projectRoot);
    expect(results).toHaveLength(0);
  });

  it('handles malformed crush.json gracefully', async () => {
    await writeFile(join(projectRoot, 'crush.json'), 'not valid json', 'utf-8');
    // Should not throw
    const results = await importFromCrush(projectRoot);
    expect(Array.isArray(results)).toBe(true);
  });

  it('skips empty hooks object in crush.json', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      hooks: {},
    });

    const results = await importFromCrush(projectRoot);

    const hooksResult = results.find((r) => r.feature === 'hooks');
    expect(hooksResult).toBeUndefined();
  });

  it('imports permissions.allowed_tools from crush.json into canonical permissions.yaml', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      permissions: {
        allowed_tools: ['Bash', 'Read'],
      },
    });

    const results = await importFromCrush(projectRoot);

    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult!.toPath).toBe('.agentsmesh/permissions.yaml');
    expect(toPosixPath(permResult!.fromPath)).toContain('crush.json');

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(content).toContain('allow:');
    expect(content).toContain('Bash');
    expect(content).toContain('Read');
  });

  it('imports options.disabled_tools from crush.json into canonical permissions.yaml deny list', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      options: {
        disabled_tools: ['bash', 'write'],
      },
    });

    const results = await importFromCrush(projectRoot);

    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult!.toPath).toBe('.agentsmesh/permissions.yaml');

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(content).toContain('deny:');
    expect(content).toContain('bash');
    expect(content).toContain('write');
  });

  it('imports both allowed_tools and disabled_tools in a single permissions round-trip', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      permissions: {
        allowed_tools: ['View', 'Grep'],
      },
      options: {
        disabled_tools: ['rm', 'curl'],
      },
    });

    const results = await importFromCrush(projectRoot);

    const permResults = results.filter((r) => r.feature === 'permissions');
    expect(permResults).toHaveLength(1);
    expect(permResults[0].toPath).toBe('.agentsmesh/permissions.yaml');

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf-8');
    expect(content).toContain('allow:');
    expect(content).toContain('View');
    expect(content).toContain('deny:');
    expect(content).toContain('rm');
  });

  it('skips permissions import when neither allowed_tools nor disabled_tools present', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      permissions: {},
      options: {},
    });

    const results = await importFromCrush(projectRoot);
    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeUndefined();
  });

  it('imports permissions from global ~/.config/crush/crush.json when scope=global', async () => {
    await mkdir(join(projectRoot, '.config', 'crush'), { recursive: true });
    await writeJson(join(projectRoot, '.config', 'crush', 'crush.json'), {
      permissions: { allowed_tools: ['GlobalTool'] },
    });

    const results = await importFromCrush(projectRoot, { scope: 'global' });

    const permResult = results.find((r) => r.feature === 'permissions');
    expect(permResult).toBeDefined();
    expect(permResult!.toPath).toBe('.agentsmesh/permissions.yaml');
    expect(toPosixPath(permResult!.fromPath)).toContain('.config/crush/crush.json');
  });

  it('skips MCP servers with neither command nor url', async () => {
    await writeJson(join(projectRoot, 'crush.json'), {
      mcp: {
        invalid: {
          type: 'stdio',
          // no command or url
        },
      },
    });

    const results = await importFromCrush(projectRoot);
    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeUndefined();
  });
});
