import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromAmazonQ } from '../../../../src/targets/amazon-q/importer.js';
import { emitAmazonQAgentSettings } from '../../../../src/targets/amazon-q/agent-outputs.js';
import { parseIgnore } from '../../../../src/canonical/features/ignore.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `amazon-q-ignore-import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeAgent(dir: string, agentDir: string, name: string, agent: unknown): void {
  mkdirSync(join(dir, agentDir), { recursive: true });
  writeFileSync(join(dir, agentDir, `${name}.json`), JSON.stringify(agent));
}

const PROJECT_AGENTS = join('.amazonq', 'cli-agents');
const GLOBAL_AGENTS = join('.aws', 'amazonq', 'cli-agents');

describe('importFromAmazonQ — toolsSettings deniedPaths to canonical ignore', () => {
  it('imports fs_read deniedPaths into .agentsmesh/ignore', async () => {
    const dir = createTempDir();
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      prompt: 'You code.',
      toolsSettings: { fs_read: { deniedPaths: ['node_modules', 'dist'] } },
    });

    const results = await importFromAmazonQ(dir);

    const ignoreResults = results.filter((r) => r.feature === 'ignore');
    expect(ignoreResults).toHaveLength(1);
    expect(ignoreResults[0].toPath).toBe('.agentsmesh/ignore');
    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe('node_modules\ndist');
  });

  it('unions fs_read and fs_write deniedPaths without duplicates', async () => {
    const dir = createTempDir();
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      prompt: 'You code.',
      toolsSettings: {
        fs_read: { deniedPaths: ['node_modules', 'dist'] },
        fs_write: { deniedPaths: ['dist', '.env'] },
      },
    });

    await importFromAmazonQ(dir);

    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe(
      'node_modules\ndist\n.env',
    );
  });

  it('unions deniedPaths across several agent files and reports each source', async () => {
    const dir = createTempDir();
    writeAgent(dir, PROJECT_AGENTS, 'a', {
      name: 'a',
      toolsSettings: { fs_read: { deniedPaths: ['dist'] } },
    });
    writeAgent(dir, PROJECT_AGENTS, 'b', {
      name: 'b',
      toolsSettings: { fs_write: { deniedPaths: ['dist', 'secrets'] } },
    });

    const results = await importFromAmazonQ(dir);

    expect(results.filter((r) => r.feature === 'ignore')).toHaveLength(2);
    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe('dist\nsecrets');
  });

  it('imports deniedPaths from global agents in global scope', async () => {
    const dir = createTempDir();
    writeAgent(dir, GLOBAL_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['~/.aws/credentials'] } },
    });

    const results = await importFromAmazonQ(dir, { scope: 'global' });

    expect(results.filter((r) => r.feature === 'ignore')).toHaveLength(1);
    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe('~/.aws/credentials');
  });

  it('ignores project agents when importing global scope', async () => {
    const dir = createTempDir();
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['dist'] } },
    });

    const results = await importFromAmazonQ(dir, { scope: 'global' });

    expect(results.filter((r) => r.feature === 'ignore')).toHaveLength(0);
    expect(existsSync(join(dir, '.agentsmesh', 'ignore'))).toBe(false);
  });

  it('writes nothing when agents carry no deniedPaths', async () => {
    const dir = createTempDir();
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      prompt: 'You code.',
      toolsSettings: { fs_read: { allowedPaths: ['./src'] } },
    });

    const results = await importFromAmazonQ(dir);

    expect(results.filter((r) => r.feature === 'ignore')).toHaveLength(0);
    expect(existsSync(join(dir, '.agentsmesh', 'ignore'))).toBe(false);
  });

  it('skips malformed agent JSON and non-string deniedPaths entries', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, PROJECT_AGENTS), { recursive: true });
    writeFileSync(join(dir, PROJECT_AGENTS, 'broken.json'), '{ not json');
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['dist', 42, null] } },
    });

    await importFromAmazonQ(dir);

    expect(readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8')).toBe('dist');
  });

  it('writes nothing when no agents directory exists', async () => {
    const dir = createTempDir();
    const results = await importFromAmazonQ(dir);
    expect(results.filter((r) => r.feature === 'ignore')).toHaveLength(0);
  });
});

function writeCanonicalIgnore(dir: string, content: string): void {
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  writeFileSync(join(dir, '.agentsmesh', 'ignore'), content);
}

function readCanonicalIgnore(dir: string): string {
  return readFileSync(join(dir, '.agentsmesh', 'ignore'), 'utf-8');
}

describe('importFromAmazonQ — preserves canonical ignore entries Amazon Q cannot express', () => {
  it('keeps comments and negations that the generator had to drop', async () => {
    const dir = createTempDir();
    writeCanonicalIgnore(dir, '# build output\ndist\n!dist/keep.txt');
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['dist'] } },
    });

    await importFromAmazonQ(dir);

    expect(readCanonicalIgnore(dir)).toBe('# build output\ndist\n!dist/keep.txt');
  });

  it('appends patterns Amazon Q added below the preserved canonical entries', async () => {
    const dir = createTempDir();
    writeCanonicalIgnore(dir, '# secrets\n.env\n!.env.example');
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['.env', 'dist'] } },
    });

    await importFromAmazonQ(dir);

    expect(readCanonicalIgnore(dir)).toBe('# secrets\n.env\n!.env.example\ndist');
  });

  it('drops a plain pattern Amazon Q no longer denies but keeps the comments around it', async () => {
    const dir = createTempDir();
    writeCanonicalIgnore(dir, '# build output\ndist\ncoverage');
    writeAgent(dir, PROJECT_AGENTS, 'coder', {
      name: 'coder',
      toolsSettings: { fs_read: { deniedPaths: ['dist'] } },
    });

    await importFromAmazonQ(dir);

    expect(readCanonicalIgnore(dir)).toBe('# build output\ndist');
  });

  it('leaves a hand-written canonical ignore untouched when no agent denies anything', async () => {
    const dir = createTempDir();
    writeCanonicalIgnore(dir, '# keep me\ndist\n!dist/keep.txt');
    writeAgent(dir, PROJECT_AGENTS, 'coder', { name: 'coder', prompt: 'You code.' });

    await importFromAmazonQ(dir);

    expect(readCanonicalIgnore(dir)).toBe('# keep me\ndist\n!dist/keep.txt');
  });
});

describe('amazon-q ignore round-trip: generate to import to generate', () => {
  function canonicalWith(ignore: string[]): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [
        {
          source: '/proj/.agentsmesh/agents/coder.md',
          name: 'coder',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {} as import('../../../../src/core/hook-types.js').Hooks,
          skills: [],
          memory: '',
          body: 'Agent body.',
        },
      ],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore,
    };
  }

  function emitAgent(canonical: CanonicalFiles): string {
    return emitAmazonQAgentSettings(canonical, 'project', new Set(['agents', 'ignore']))[0].content;
  }

  it('re-generates byte-identical agent JSON after a full round-trip', async () => {
    const patterns = ['node_modules', 'src/**/*.gen.ts', '.env'];
    const dir = createTempDir();
    const generated = emitAgent(canonicalWith(patterns));
    mkdirSync(join(dir, PROJECT_AGENTS), { recursive: true });
    writeFileSync(join(dir, PROJECT_AGENTS, 'coder.json'), generated);

    await importFromAmazonQ(dir);
    const reimported = await parseIgnore(join(dir, '.agentsmesh', 'ignore'));

    expect(reimported).toEqual(patterns);
    expect(emitAgent(canonicalWith(reimported))).toBe(generated);
  });

  it('survives the lossy round-trip: the dropped negation is still canonical afterwards', async () => {
    const patterns = ['dist', '!dist/keep.txt'];
    const dir = createTempDir();
    writeCanonicalIgnore(dir, '# build output\ndist\n!dist/keep.txt');
    mkdirSync(join(dir, PROJECT_AGENTS), { recursive: true });
    writeFileSync(join(dir, PROJECT_AGENTS, 'coder.json'), emitAgent(canonicalWith(patterns)));

    await importFromAmazonQ(dir);

    expect(await parseIgnore(join(dir, '.agentsmesh', 'ignore'))).toEqual(patterns);
  });
});
