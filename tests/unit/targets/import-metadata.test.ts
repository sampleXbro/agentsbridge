import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  serializeImportedAgentWithFallback,
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
  serializeImportedSkillWithFallback,
} from '../../../src/targets/import/import-metadata.js';

describe('import metadata placeholders', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-import-metadata-'));
    tempDirs.push(dir);
    return dir;
  }

  it('adds placeholder command metadata when the imported source has no frontmatter', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'commands', 'review.md');
    mkdirSync(join(dir, '.agentsmesh', 'commands'), { recursive: true });

    const content = await serializeImportedCommandWithFallback(
      destPath,
      {
        description: undefined,
        hasDescription: false,
        allowedTools: undefined,
        hasAllowedTools: false,
      },
      'Review body.',
    );

    expect(content).toContain('description: ""');
    expect(content).toContain('allowed-tools: []');
    expect(content).toContain('Review body.');
  });

  it('adds placeholder rule metadata when a non-root imported rule has no frontmatter', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'rules', 'frontend', 'react.md');
    mkdirSync(join(dir, '.agentsmesh', 'rules', 'frontend'), { recursive: true });

    const content = await serializeImportedRuleWithFallback(
      destPath,
      { root: false },
      'Rule body.',
    );

    expect(content).toContain('root: false');
    expect(content).toContain('description: ""');
    expect(content).toContain('globs: []');
    expect(content).toContain('Rule body.');
  });

  it('adds placeholder skill metadata when the imported SKILL.md has no frontmatter', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'skills', 'qa', 'SKILL.md');
    mkdirSync(join(dir, '.agentsmesh', 'skills', 'qa'), { recursive: true });

    const content = await serializeImportedSkillWithFallback(destPath, {}, 'Skill body.');

    expect(content).toContain('name: qa');
    expect(content).toContain('description: ""');
    expect(content).toContain('Skill body.');
  });

  it('adds placeholder agent metadata when the imported agent has no frontmatter', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'agents', 'reviewer.md');
    mkdirSync(join(dir, '.agentsmesh', 'agents'), { recursive: true });

    const content = await serializeImportedAgentWithFallback(destPath, {}, 'Agent body.');

    expect(content).toContain('name: reviewer');
    expect(content).toContain('description: ""');
    expect(content).toContain('tools: []');
    expect(content).toContain('Agent body.');
  });

  it('preserves existing canonical skill description when the imported source omits it', async () => {
    const dir = createTempDir();
    const destPath = join(dir, '.agentsmesh', 'skills', 'qa', 'SKILL.md');
    mkdirSync(join(dir, '.agentsmesh', 'skills', 'qa'), { recursive: true });
    writeFileSync(destPath, '---\nname: qa\ndescription: Existing QA\n---\n\nOld body.\n');

    const content = await serializeImportedSkillWithFallback(destPath, {}, 'New body.');

    expect(content).toContain('description: Existing QA');
    expect(content).toContain('New body.');
    expect(readFileSync(destPath, 'utf-8')).toContain('Existing QA');
  });
});
