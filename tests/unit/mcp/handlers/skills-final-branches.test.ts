/**
 * Branch coverage for src/mcp/handlers/skills.ts lines 92, 174, 184:
 *   - get(): non-ENOENT IO error → IO_ERROR (line 92)
 *   - update(): non-ENOENT IO error reading existing SKILL.md → IO_ERROR (174)
 *   - update(): merged frontmatter fails schema validation (184)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { skillsHandlers } from '../../../../src/mcp/handlers/skills.js';
import { McpError } from '../../../../src/mcp/errors.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;

function ctx(): McpContext {
  return { projectRoot } as McpContext;
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-skills-final-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('skillsHandlers.get — non-ENOENT IO error path', () => {
  it('throws IO_ERROR when SKILL.md is a directory instead of a file (EISDIR)', async () => {
    // Create a directory named SKILL.md inside the skill folder. readFile on
    // a directory yields EISDIR, exercising the non-ENOENT throw branch.
    const skillDir = resolve(projectRoot, '.agentsmesh/skills/x');
    mkdirSync(resolve(skillDir, 'SKILL.md'), { recursive: true });

    await expect(skillsHandlers.get(ctx(), { name: 'x' })).rejects.toMatchObject({
      code: 'IO_ERROR',
    });
  });
});

describe('skillsHandlers.update — branches', () => {
  it('throws IO_ERROR when SKILL.md is a directory (EISDIR) during update', async () => {
    const skillDir = resolve(projectRoot, '.agentsmesh/skills/y');
    mkdirSync(resolve(skillDir, 'SKILL.md'), { recursive: true });

    await expect(
      skillsHandlers.update(ctx(), { name: 'y', body: 'new body' }),
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
  });

  it('throws VALIDATION_FAILED when the (possibly merged) frontmatter is invalid', async () => {
    // Seed a valid skill, then update with frontmatter whose `description`
    // field is a non-string (number), which the schema rejects.
    const skillDir = resolve(projectRoot, '.agentsmesh/skills/z');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      resolve(skillDir, 'SKILL.md'),
      '---\nname: z\ndescription: ok\n---\n\n# body\n',
      'utf-8',
    );

    await expect(
      skillsHandlers.update(ctx(), {
        name: 'z',
        // Numeric description violates the schema after merge.
        frontmatter: { description: 12345 as unknown as string },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('McpError class shape (smoke for matcher)', () => {
  it('is thrown with code property accessible to test matchers', () => {
    expect(new McpError('IO_ERROR', 'x').code).toBe('IO_ERROR');
  });
});
