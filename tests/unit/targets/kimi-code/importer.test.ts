import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { importFromKimiCode } from '../../../../src/targets/kimi-code/importer.js';

let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function project(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'kimi-import-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf-8');
}

const ROOT_WITH_EMBEDDED = `# Root

Use TDD.

<!-- agentsmesh:embedded-rules:start -->
<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md","description":"TypeScript standards","globs":["**/*.ts"],"targets":[]} -->
## TypeScript standards

No \`any\`.
<!-- agentsmesh:embedded-rule:end -->
<!-- agentsmesh:embedded-rules:end -->
`;

describe('importFromKimiCode (project scope)', () => {
  it('splits the embedded rules block back into separate canonical rules', async () => {
    const root = project({ 'AGENTS.md': ROOT_WITH_EMBEDDED });
    const results = await importFromKimiCode(root);
    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/typescript.md',
    ]);
    expect(read(root, '.agentsmesh/rules/_root.md')).not.toContain('embedded-rule');
    expect(read(root, '.agentsmesh/rules/_root.md')).toContain('Use TDD.');
    const rule = read(root, '.agentsmesh/rules/typescript.md');
    expect(rule).toContain('description: TypeScript standards');
    expect(rule).toContain('No `any`.');
  });

  it('reads .kimi-code/AGENTS.md when it is the only instruction file', async () => {
    const root = project({ '.kimi-code/AGENTS.md': '# Nested root\n' });
    const results = await importFromKimiCode(root, { scope: 'project' });
    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
    expect(read(root, '.agentsmesh/rules/_root.md')).toContain('# Nested root');
  });

  it('imports agents, skills, projected commands and MCP servers', async () => {
    const root = project({
      'AGENTS.md': '# Root\n',
      '.kimi-code/agents/code-reviewer.md':
        '---\nname: code-reviewer\ndescription: Reviews diffs\ntools: [Read]\n---\nReview it.\n',
      '.kimi-code/skills/api-generator/SKILL.md':
        '---\nname: api-generator\ndescription: Scaffold routes\n---\nScaffold.\n',
      '.kimi-code/skills/api-generator/references/checklist.md': '- one\n',
      '.kimi-code/skills/am-command-review/SKILL.md':
        '---\nname: am-command-review\ndescription: Review\nx-agentsmesh-kind: command\nx-agentsmesh-name: review\n---\nReview the tree.\n',
      '.kimi-code/mcp.json':
        '{"mcpServers":{"context7":{"type":"stdio","command":"npx","args":["-y","@upstash/context7-mcp"]}}}',
    });

    const results = await importFromKimiCode(root, { scope: 'project' });

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/checklist.md',
    ]);
    expect(read(root, '.agentsmesh/commands/review.md')).toContain('Review the tree.');
    expect(JSON.parse(read(root, '.agentsmesh/mcp.json')).mcpServers.context7.command).toBe('npx');
  });

  it('never reads the repo-root .mcp.json that Claude Code owns', async () => {
    const root = project({
      'AGENTS.md': '# Root\n',
      '.mcp.json': '{"mcpServers":{"claude-only":{"command":"claude"}}}',
    });
    const results = await importFromKimiCode(root, { scope: 'project' });
    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/_root.md']);
  });

  it('does not read the user-level config.toml at project scope', async () => {
    const root = project({
      'AGENTS.md': '# Root\n',
      '.kimi-code/config.toml': '[[hooks]]\nevent = "Stop"\ncommand = "notify"\n',
    });
    const results = await importFromKimiCode(root, { scope: 'project' });
    expect(results.map((r) => r.feature)).toEqual(['rules']);
  });

  it('returns nothing for an empty project', async () => {
    expect(await importFromKimiCode(project({}))).toEqual([]);
  });
});

describe('importFromKimiCode (global scope)', () => {
  it('reads the Kimi-specific instruction file first', async () => {
    const root = project({
      '.kimi-code/AGENTS.md': '# Kimi global\n',
      '.agents/AGENTS.md': '# Shared global\n',
    });
    await importFromKimiCode(root, { scope: 'global' });
    const rootRule = read(root, '.agentsmesh/rules/_root.md');
    expect(rootRule.indexOf('# Kimi global')).toBeLessThan(rootRule.indexOf('# Shared global'));
  });

  it('reads the cross-tool ~/.agents/AGENTS.md when it is the only one', async () => {
    const root = project({ '.agents/AGENTS.md': '# Shared global\n' });
    await importFromKimiCode(root, { scope: 'global' });
    expect(read(root, '.agentsmesh/rules/_root.md')).toContain('# Shared global');
  });

  it('imports hooks and permissions from config.toml', async () => {
    const root = project({
      '.kimi-code/config.toml': `[providers.kimi]
type = "kimi"
api_key = "sk-live"

[[hooks]]
event = "PostToolUse"
matcher = "Write"
command = "fmt"
timeout = 12

[[permission.rules]]
decision = "allow"
pattern = "Read"

[[permission.rules]]
decision = "deny"
pattern = "WebFetch"
`,
    });

    const results = await importFromKimiCode(root, { scope: 'global' });

    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/hooks.yaml',
      '.agentsmesh/permissions.yaml',
    ]);
    expect(parseYaml(read(root, '.agentsmesh/hooks.yaml'))).toEqual({
      PostToolUse: [{ matcher: 'Write', command: 'fmt', timeout: 12 }],
    });
    expect(parseYaml(read(root, '.agentsmesh/permissions.yaml'))).toEqual({
      allow: ['Read'],
      deny: ['WebFetch'],
    });
  });

  it('keeps canonical entries Kimi Code cannot express', async () => {
    const root = project({
      '.kimi-code/config.toml': '[[permission.rules]]\ndecision = "allow"\npattern = "Read"\n',
      '.agentsmesh/permissions.yaml': "allow: ['Bash(', 'Grep']\ndeny: ['WebFetch']\n",
    });
    await importFromKimiCode(root, { scope: 'global' });
    expect(parseYaml(read(root, '.agentsmesh/permissions.yaml'))).toEqual({
      allow: ['Read', 'Bash('],
      deny: ['WebFetch'],
    });
  });

  it('imports nothing from a config.toml it cannot parse', async () => {
    const root = project({ '.kimi-code/config.toml': '[providers.kimi\napi_key = "sk"' });
    expect(await importFromKimiCode(root, { scope: 'global' })).toEqual([]);
  });

  it('ignores a config.toml with neither owned key', async () => {
    const root = project({ '.kimi-code/config.toml': '[providers.kimi]\ntype = "kimi"\n' });
    expect(await importFromKimiCode(root, { scope: 'global' })).toEqual([]);
  });
});
