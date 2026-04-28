import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

/*
 * Integration coverage for the case: a skill (`.agentsmesh/skills/<name>/SKILL.md`
 * or one of its supporting files) embeds an *absolute* link to another reference
 * inside `.agentsmesh/`. After `agentsmesh generate`, the absolute link in the
 * generated tool-side artifact must be rewritten to a destination-relative form
 * in BOTH project and global scope.
 *
 * Project scope: canonical lives at `<tmpRoot>/.agentsmesh/...` and output goes to
 * `<tmpRoot>/.claude/...`.
 *
 * Global scope: canonical lives at `<homeDir>/.agentsmesh/...` and output goes to
 * `<homeDir>/.claude/...`. We simulate this by setting `HOME`/`USERPROFILE` to a
 * temp dir and invoking `generate --global` from there.
 */

function makeEnv(homeDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
}

describe('generate: skill absolute links → relative (integration, project scope)', () => {
  let testDir = '';

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'am-skill-abs-links-project-')));
  });

  afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  });

  // Windows absolute paths (`C:\...`) are intentionally preserved by the link
  // rebaser — see `WINDOWS_ABSOLUTE_PATH` in `src/core/reference/link-rebaser.ts`
  // and the rationale in `tasks/lessons.md` (realpath divergence under
  // 8.3-shortname tmpdirs). On Windows runners this test's input *is* a
  // Windows absolute path, so the rewrite is correctly skipped.
  it.skipIf(process.platform === 'win32')(
    'rewrites POSIX absolute links inside SKILL.md, supporting file, and across skills to destination-relative paths',
    () => {
      writeFileSync(
        join(testDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, commands, skills]
`,
      );
      mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
      mkdirSync(join(testDir, '.agentsmesh', 'commands'), { recursive: true });
      mkdirSync(join(testDir, '.agentsmesh', 'skills', 'qa', 'references'), { recursive: true });
      mkdirSync(join(testDir, '.agentsmesh', 'skills', 'release-manager'), { recursive: true });

      writeFileSync(
        join(testDir, '.agentsmesh', 'rules', '_root.md'),
        ['---', 'root: true', 'description: Root rule', '---', 'Root rule body.'].join('\n'),
      );
      writeFileSync(
        join(testDir, '.agentsmesh', 'rules', 'typescript.md'),
        ['---', 'description: TypeScript rule', 'globs: ["**/*.ts"]', '---', 'Strict mode.'].join(
          '\n',
        ),
      );
      writeFileSync(
        join(testDir, '.agentsmesh', 'commands', 'review.md'),
        ['---', 'description: Review', '---', 'Review body.'].join('\n'),
      );
      writeFileSync(
        join(testDir, '.agentsmesh', 'skills', 'release-manager', 'SKILL.md'),
        [
          '---',
          'name: release-manager',
          'description: Release manager',
          '---',
          'Release body.',
        ].join('\n'),
      );

      const skillBody = [
        '---',
        'name: qa',
        'description: QA skill with absolute links',
        '---',
        `See \`${testDir}/.agentsmesh/rules/typescript.md\` for style.`,
        `Run [review](${testDir}/.agentsmesh/commands/review.md) before merge.`,
        `Sibling: \`${testDir}/.agentsmesh/skills/qa/references/checklist.md\`.`,
        `Cross-skill: [release manager](${testDir}/.agentsmesh/skills/release-manager/SKILL.md).`,
        `Skill dir: [release manager skill](${testDir}/.agentsmesh/skills/release-manager/).`,
        `Inside fence:`,
        '```',
        `${testDir}/.agentsmesh/rules/typescript.md`,
        '```',
      ].join('\n');
      writeFileSync(join(testDir, '.agentsmesh', 'skills', 'qa', 'SKILL.md'), skillBody);

      writeFileSync(
        join(testDir, '.agentsmesh', 'skills', 'qa', 'references', 'checklist.md'),
        [
          '# QA Checklist',
          '',
          `Back to [SKILL](${testDir}/.agentsmesh/skills/qa/SKILL.md).`,
          `Cross-rule: \`${testDir}/.agentsmesh/rules/typescript.md\`.`,
        ].join('\n'),
      );

      execSync(`node ${CLI_PATH} generate`, { cwd: testDir, env: process.env, stdio: 'pipe' });

      const generatedSkill = readFileSync(
        join(testDir, '.claude', 'skills', 'qa', 'SKILL.md'),
        'utf-8',
      );
      const generatedChecklist = readFileSync(
        join(testDir, '.claude', 'skills', 'qa', 'references', 'checklist.md'),
        'utf-8',
      );

      // SKILL.md: each absolute path becomes destination-relative.
      expect(generatedSkill).toContain('See `../../rules/typescript.md` for style.');
      expect(generatedSkill).toContain('Run [review](../../commands/review.md) before merge.');
      expect(generatedSkill).toContain('Sibling: `./references/checklist.md`.');
      expect(generatedSkill).toContain(
        'Cross-skill: [release manager](../release-manager/SKILL.md).',
      );
      expect(generatedSkill).toContain('Skill dir: [release manager skill](../release-manager/).');

      // Fenced code block must be preserved verbatim.
      expect(generatedSkill).toContain(`${testDir}/.agentsmesh/rules/typescript.md`);

      // Outside the fence, no leftover absolute path text.
      const proseOnly = generatedSkill.replace(/```[\s\S]*?```/g, '');
      expect(proseOnly).not.toContain(`${testDir}/.agentsmesh/`);

      // Supporting file: absolute paths rewritten to relative.
      expect(generatedChecklist).toContain('Back to [SKILL](../SKILL.md).');
      expect(generatedChecklist).toContain('Cross-rule: `../../../rules/typescript.md`.');
      expect(generatedChecklist).not.toContain(`${testDir}/.agentsmesh/`);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'fails generation when a SKILL.md markdown destination contains a non-existent absolute path',
    () => {
      writeFileSync(
        join(testDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [skills]
`,
      );
      mkdirSync(join(testDir, '.agentsmesh', 'skills', 'qa'), { recursive: true });
      writeFileSync(
        join(testDir, '.agentsmesh', 'skills', 'qa', 'SKILL.md'),
        [
          '---',
          'name: qa',
          'description: QA',
          '---',
          `See [missing](${testDir}/.agentsmesh/rules/missing.md).`,
        ].join('\n'),
      );

      let stderr = '';
      let exitCode = 0;
      try {
        execSync(`node ${CLI_PATH} generate`, { cwd: testDir, env: process.env, stdio: 'pipe' });
      } catch (err) {
        const e = err as { status?: number; stderr?: Buffer; stdout?: Buffer };
        exitCode = e.status ?? 0;
        stderr = `${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`;
      }

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/broken local links/);
      expect(stderr).toContain(`${testDir}/.agentsmesh/rules/missing.md`);
    },
  );

  it('rewrites root-relative `/.agentsmesh/...` tokens inside SKILL.md to destination-relative paths', () => {
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, skills]
`,
    );
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(testDir, '.agentsmesh', 'skills', 'qa'), { recursive: true });

    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      ['---', 'root: true', 'description: Root', '---', 'Root.'].join('\n'),
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', 'typescript.md'),
      ['---', 'description: TS rule', 'globs: ["**/*.ts"]', '---', 'Strict.'].join('\n'),
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'skills', 'qa', 'SKILL.md'),
      ['---', 'name: qa', 'description: QA', '---', 'See `/.agentsmesh/rules/typescript.md`.'].join(
        '\n',
      ),
    );

    execSync(`node ${CLI_PATH} generate`, { cwd: testDir, env: process.env, stdio: 'pipe' });

    const out = readFileSync(join(testDir, '.claude', 'skills', 'qa', 'SKILL.md'), 'utf-8');
    expect(out).toContain('See `../../rules/typescript.md`.');
    expect(out).not.toContain('/.agentsmesh/');
  });
});

describe('generate: skill absolute links → relative (integration, global scope)', () => {
  let homeDir = '';

  beforeEach(() => {
    homeDir = realpathSync(mkdtempSync(join(tmpdir(), 'am-skill-abs-links-global-')));
  });

  afterEach(() => {
    if (homeDir) rmSync(homeDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')(
    'rewrites HOME-rooted absolute links inside SKILL.md and supporting files to destination-relative paths',
    () => {
      const meshDir = join(homeDir, '.agentsmesh');
      mkdirSync(join(meshDir, 'rules'), { recursive: true });
      mkdirSync(join(meshDir, 'skills', 'qa', 'references'), { recursive: true });
      mkdirSync(join(meshDir, 'skills', 'release-manager'), { recursive: true });

      writeFileSync(
        join(meshDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [rules, skills]
`,
      );

      writeFileSync(
        join(meshDir, 'rules', '_root.md'),
        ['---', 'root: true', 'description: Root rule', '---', 'Root rule body.'].join('\n'),
      );
      writeFileSync(
        join(meshDir, 'rules', 'typescript.md'),
        ['---', 'description: TS rule', 'globs: ["**/*.ts"]', '---', 'Strict mode.'].join('\n'),
      );
      writeFileSync(
        join(meshDir, 'skills', 'release-manager', 'SKILL.md'),
        [
          '---',
          'name: release-manager',
          'description: Release manager',
          '---',
          'Release body.',
        ].join('\n'),
      );

      const skillBody = [
        '---',
        'name: qa',
        'description: QA skill with HOME-rooted absolute links',
        '---',
        `See \`${homeDir}/.agentsmesh/rules/typescript.md\` for style.`,
        `Sibling: \`${homeDir}/.agentsmesh/skills/qa/references/checklist.md\`.`,
        `Cross-skill: [release manager](${homeDir}/.agentsmesh/skills/release-manager/SKILL.md).`,
        `Skill dir: [release manager skill](${homeDir}/.agentsmesh/skills/release-manager/).`,
        `Inside fence:`,
        '```',
        `${homeDir}/.agentsmesh/rules/typescript.md`,
        '```',
      ].join('\n');
      writeFileSync(join(meshDir, 'skills', 'qa', 'SKILL.md'), skillBody);

      writeFileSync(
        join(meshDir, 'skills', 'qa', 'references', 'checklist.md'),
        [
          '# QA Checklist',
          '',
          `Back to [SKILL](${homeDir}/.agentsmesh/skills/qa/SKILL.md).`,
          `Cross-rule: \`${homeDir}/.agentsmesh/rules/typescript.md\`.`,
        ].join('\n'),
      );

      execSync(`node ${CLI_PATH} generate --global`, {
        cwd: homeDir,
        env: makeEnv(homeDir),
        stdio: 'pipe',
      });

      const generatedSkill = readFileSync(
        join(homeDir, '.claude', 'skills', 'qa', 'SKILL.md'),
        'utf-8',
      );
      const generatedChecklist = readFileSync(
        join(homeDir, '.claude', 'skills', 'qa', 'references', 'checklist.md'),
        'utf-8',
      );

      expect(generatedSkill).toContain('See `../../rules/typescript.md` for style.');
      expect(generatedSkill).toContain('Sibling: `./references/checklist.md`.');
      expect(generatedSkill).toContain(
        'Cross-skill: [release manager](../release-manager/SKILL.md).',
      );
      expect(generatedSkill).toContain('Skill dir: [release manager skill](../release-manager/).');

      // Fenced code block must be preserved verbatim.
      expect(generatedSkill).toContain(`${homeDir}/.agentsmesh/rules/typescript.md`);

      // Outside the fence, no leftover absolute path text.
      const proseOnly = generatedSkill.replace(/```[\s\S]*?```/g, '');
      expect(proseOnly).not.toContain(`${homeDir}/.agentsmesh/`);

      // Supporting file: absolute paths rewritten.
      expect(generatedChecklist).toContain('Back to [SKILL](../SKILL.md).');
      expect(generatedChecklist).toContain('Cross-rule: `../../../rules/typescript.md`.');
      expect(generatedChecklist).not.toContain(`${homeDir}/.agentsmesh/`);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'fails global generation when a SKILL.md markdown destination contains a non-existent HOME-rooted absolute path',
    () => {
      const meshDir = join(homeDir, '.agentsmesh');
      mkdirSync(join(meshDir, 'skills', 'qa'), { recursive: true });

      writeFileSync(
        join(meshDir, 'agentsmesh.yaml'),
        `version: 1
targets: [claude-code]
features: [skills]
`,
      );
      writeFileSync(
        join(meshDir, 'skills', 'qa', 'SKILL.md'),
        [
          '---',
          'name: qa',
          'description: QA',
          '---',
          `See [missing](${homeDir}/.agentsmesh/rules/missing.md).`,
        ].join('\n'),
      );

      let stderr = '';
      let exitCode = 0;
      try {
        execSync(`node ${CLI_PATH} generate --global`, {
          cwd: homeDir,
          env: makeEnv(homeDir),
          stdio: 'pipe',
        });
      } catch (err) {
        const e = err as { status?: number; stderr?: Buffer; stdout?: Buffer };
        exitCode = e.status ?? 0;
        stderr = `${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`;
      }

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/broken local links/);
      expect(stderr).toContain(`${homeDir}/.agentsmesh/rules/missing.md`);
    },
  );

  it('rewrites root-relative `/.agentsmesh/...` tokens inside SKILL.md (global scope)', () => {
    const meshDir = join(homeDir, '.agentsmesh');
    mkdirSync(join(meshDir, 'rules'), { recursive: true });
    mkdirSync(join(meshDir, 'skills', 'qa'), { recursive: true });

    writeFileSync(
      join(meshDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules, skills]
`,
    );
    writeFileSync(
      join(meshDir, 'rules', '_root.md'),
      ['---', 'root: true', 'description: Root', '---', 'Root.'].join('\n'),
    );
    writeFileSync(
      join(meshDir, 'rules', 'typescript.md'),
      ['---', 'description: TS rule', 'globs: ["**/*.ts"]', '---', 'Strict.'].join('\n'),
    );
    writeFileSync(
      join(meshDir, 'skills', 'qa', 'SKILL.md'),
      ['---', 'name: qa', 'description: QA', '---', 'See `/.agentsmesh/rules/typescript.md`.'].join(
        '\n',
      ),
    );

    execSync(`node ${CLI_PATH} generate --global`, {
      cwd: homeDir,
      env: makeEnv(homeDir),
      stdio: 'pipe',
    });

    const out = readFileSync(join(homeDir, '.claude', 'skills', 'qa', 'SKILL.md'), 'utf-8');
    expect(out).toContain('See `../../rules/typescript.md`.');
    expect(out).not.toContain('/.agentsmesh/');
  });
});
