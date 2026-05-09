import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import {
  fileExists,
  fileContains,
  readText,
  validJson,
  dirFilesExactly,
  fileNotExists,
} from './helpers/assertions.js';
import { markdownFrontmatter } from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

/**
 * Global AugmentCode layout (descriptor.globalSupport + constants):
 * - Rules:    ~/.augment/rules/*.md       (always_apply / agent_requested frontmatter)
 * - Commands: ~/.augment/commands/*.md
 * - Skills:   ~/.augment/skills/<name>/SKILL.md
 * - MCP+Hooks: ~/.augment/settings.json  (merged JSON)
 * - .augmentignore: NOT emitted in global mode (rewriteGeneratedPath returns null)
 */
describe('global mode round-trip: AugmentCode', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → restores rules, commands, skills, MCP', async () => {
    const { homeDir, canonicalDir, projectDir } = env;

    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'commands'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'augment-skill'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root guidelines\n---\n# Root\nAugmentCode root body\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'typescript.md'),
      '---\ndescription: TypeScript rules\n---\n# TypeScript\nUse strict mode\n',
    );
    writeFileSync(
      join(canonicalDir, 'commands', 'review.md'),
      '---\ndescription: Code review\n---\n# Review\nReview the code\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'augment-skill', 'SKILL.md'),
      '---\ndescription: Augment skill\nname: augment-skill\n---\n# Augment Skill\nSkill content\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      JSON.stringify(
        { mcpServers: { context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } } },
        null,
        2,
      ),
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [augment-code]\nfeatures: [rules, commands, skills, mcp]\n',
    );

    const gen = await runCli('generate --global --targets augment-code', projectDir);
    expect(gen.exitCode).toBe(0);

    // Rules emitted to ~/.augment/rules/
    fileExists(join(homeDir, '.augment', 'rules', '_root.md'));
    fileContains(join(homeDir, '.augment', 'rules', '_root.md'), 'AugmentCode root body');
    fileContains(join(homeDir, '.augment', 'rules', '_root.md'), 'always_apply: true');

    fileExists(join(homeDir, '.augment', 'rules', 'typescript.md'));
    fileContains(join(homeDir, '.augment', 'rules', 'typescript.md'), 'Use strict mode');

    // Commands emitted to ~/.augment/commands/
    fileExists(join(homeDir, '.augment', 'commands', 'review.md'));
    fileContains(join(homeDir, '.augment', 'commands', 'review.md'), 'Review the code');

    // Skills emitted to ~/.augment/skills/
    fileExists(join(homeDir, '.augment', 'skills', 'augment-skill', 'SKILL.md'));
    fileContains(
      join(homeDir, '.augment', 'skills', 'augment-skill', 'SKILL.md'),
      'Skill content',
    );
    expect(
      markdownFrontmatter(join(homeDir, '.augment', 'skills', 'augment-skill', 'SKILL.md')).name,
    ).toBe('augment-skill');

    // MCP embedded in ~/.augment/settings.json
    fileExists(join(homeDir, '.augment', 'settings.json'));
    validJson(join(homeDir, '.augment', 'settings.json'));
    expect(
      JSON.parse(readText(join(homeDir, '.augment', 'settings.json'))).mcpServers,
    ).toHaveProperty('context7');

    // .augmentignore must NOT be emitted in global mode
    fileNotExists(join(homeDir, '.augmentignore'));

    dirFilesExactly(join(homeDir, '.augment'), [
      'commands/review.md',
      'rules/_root.md',
      'rules/typescript.md',
      'settings.json',
      'skills/augment-skill/SKILL.md',
    ]);

    // Clear canonical dir and run import
    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from augment-code', projectDir);
    expect(imp.exitCode).toBe(0);

    fileExists(join(canonicalDir, 'rules', '_root.md'));
    fileContains(join(canonicalDir, 'rules', '_root.md'), 'AugmentCode root body');

    fileExists(join(canonicalDir, 'rules', 'typescript.md'));
    fileContains(join(canonicalDir, 'rules', 'typescript.md'), 'Use strict mode');

    fileExists(join(canonicalDir, 'commands', 'review.md'));
    fileContains(join(canonicalDir, 'commands', 'review.md'), 'Review the code');

    fileExists(join(canonicalDir, 'skills', 'augment-skill', 'SKILL.md'));
    fileContains(join(canonicalDir, 'skills', 'augment-skill', 'SKILL.md'), 'Skill content');

    fileExists(join(canonicalDir, 'mcp.json'));
    validJson(join(canonicalDir, 'mcp.json'));
  });
});
