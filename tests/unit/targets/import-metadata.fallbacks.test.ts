import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../../../src/targets/import/import-metadata.js';
import { AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH } from '../../../src/targets/projection/root-instruction-paragraph.js';

describe('import metadata fallbacks', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-import-fallbacks-'));
    tempDirs.push(dir);
    return dir;
  }

  it('merges root rule metadata and strips the appended canonical contract paragraph', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'rules', '_root.md');
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      destPath,
      [
        '---',
        'description: Existing root',
        'owner: platform',
        'root: false',
        '---',
        '',
        'Old.',
      ].join('\n'),
    );

    const content = await serializeImportedRuleWithFallback(
      destPath,
      { owner: undefined, tags: ['cli'] },
      `Use TypeScript.\n\n${AGENTSMESH_ROOT_INSTRUCTION_PARAGRAPH}`,
    );

    expect(content).toContain('root: true');
    expect(content).toContain('description: Existing root');
    expect(content).toContain('tags:');
    expect(content).toContain('- cli');
    expect(content).toContain('Use TypeScript.');
    expect(content).not.toContain('globs:');
    expect(content).not.toContain('owner: platform');
    expect(content).not.toContain('AgentsMesh Generation Contract');
  });

  it('reuses existing command metadata from camelCase and kebab-case fields when import omits them', async () => {
    const dir = createTempDir();
    const camelPath = join(dir, '.agentsmesh', 'commands', 'review.md');
    const kebabPath = join(dir, '.agentsmesh', 'commands', 'lint.md');
    mkdirSync(join(dir, '.agentsmesh', 'commands'), { recursive: true });
    writeFileSync(
      camelPath,
      ['---', 'description: Existing review', 'allowedTools:', '  - Read', '  - Grep', '---'].join(
        '\n',
      ),
    );
    writeFileSync(
      kebabPath,
      ['---', 'description: Existing lint', 'allowed-tools: Bash(npm test), Edit', '---'].join(
        '\n',
      ),
    );

    const fromCamel = await serializeImportedCommandWithFallback(
      camelPath,
      {
        description: undefined,
        hasDescription: false,
        allowedTools: undefined,
        hasAllowedTools: false,
      },
      'Review.',
    );
    const fromKebab = await serializeImportedCommandWithFallback(
      kebabPath,
      {
        description: undefined,
        hasDescription: false,
        allowedTools: undefined,
        hasAllowedTools: false,
      },
      'Lint.',
    );

    expect(fromCamel).toContain('description: Existing review');
    expect(fromCamel).toContain('- Read');
    expect(fromCamel).toContain('- Grep');
    expect(fromKebab).toContain('description: Existing lint');
    expect(fromKebab).toContain('- Bash(npm test)');
    expect(fromKebab).toContain('- Edit');
  });

  it('normalizes imported and existing agent metadata across camelCase and kebab-case variants', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'agents', 'reviewer.md');
    mkdirSync(join(dir, '.agentsmesh', 'agents'), { recursive: true });
    writeFileSync(
      destPath,
      [
        '---',
        'name: canonical-reviewer',
        'description: Existing description',
        'model: gpt-5',
        'permission-mode: workspace-write',
        'mcpServers:',
        '  - existing-mcp',
        'hooks:',
        '  PreToolUse:',
        '    - matcher: "*"',
        '      command: echo before',
        'memory: memory.md',
        '---',
        '',
        'Old body.',
      ].join('\n'),
    );

    const content = await serializeImportedAgentWithFallback(
      destPath,
      {
        tools: 'Read, Grep',
        'disallowed-tools': 'Edit, Bash',
        'mcp-servers': 'docs, context7',
        skills: 'qa, review',
        'max-turns': '7',
        hooks: [],
        memory: 42,
      },
      'Agent body.',
    );

    expect(content).toContain('name: canonical-reviewer');
    expect(content).toContain('description: Existing description');
    expect(content).toContain('- Read');
    expect(content).toContain('- Grep');
    expect(content).toContain('disallowedTools:');
    expect(content).toContain('- Edit');
    expect(content).toContain('- Bash');
    expect(content).toContain('model: gpt-5');
    expect(content).toContain('permissionMode: workspace-write');
    expect(content).toContain('maxTurns: 7');
    expect(content).toContain('mcpServers:');
    expect(content).toContain('- docs');
    expect(content).toContain('- context7');
    expect(content).toContain('hooks:');
    expect(content).toContain('memory: memory.md');
    expect(content).toContain('skills:');
    expect(content).toContain('- qa');
    expect(content).toContain('- review');
  });
});
