import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cleanup, createTestProject } from './helpers/setup.js';
import { fileContains, fileExists, fileNotExists } from './helpers/assertions.js';
import { runCli } from './helpers/run-cli.js';

describe('generate output collisions', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('deduplicates identical AGENTS.md outputs from codex-cli and windsurf', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [codex-cli, windsurf]
features: [rules]
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Shared root
---
# Shared root
`,
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(0);
    fileExists(join(dir, 'AGENTS.md'));
    const agentsMatches = (result.stdout.match(/AGENTS\.md/g) ?? []).length;
    expect(agentsMatches).toBe(1);
  });

  it('fails before writing files when targets generate conflicting content for the same path', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [cline, windsurf]
features: [rules, skills]
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Shared root
---
Use .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'),
      `---
description: QA
---
Run QA.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '- check\n',
    );

    const result = await runCli('generate', dir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Conflicting generated outputs for AGENTS.md');
    fileNotExists(join(dir, 'AGENTS.md'));
  });

  it('prefers codex AGENTS.md when rewritten overlaps differ between codex-cli and windsurf', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [codex-cli, windsurf]
features: [rules, skills]
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Shared root
---
Use .agentsbridge/skills/post-feature-qa/ and .agentsbridge/skills/post-feature-qa/references/.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'),
      `---
description: QA
---
Run QA.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '- check\n',
    );

    const result = await runCli('generate --refresh-cache', dir);

    expect(result.exitCode).toBe(0);
    fileExists(join(dir, 'AGENTS.md'));
    fileContains(join(dir, 'AGENTS.md'), '.agents/skills/post-feature-qa/');
    fileContains(join(dir, 'AGENTS.md'), '.agents/skills/post-feature-qa/references/');
  });

  it('deduplicates AGENTS.md overlaps after import-normalized relative skill links', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.agentsbridge', 'rules'), { recursive: true });
    mkdirSync(join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [codex-cli, windsurf]
features: [rules, skills]
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
description: Shared root
---
Use ../skills/post-feature-qa/ and ../skills/post-feature-qa/references/.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'SKILL.md'),
      `---
description: QA
---
Run QA.
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'skills', 'post-feature-qa', 'references', 'checklist.md'),
      '- check\n',
    );

    const result = await runCli('generate', dir);

    expect(result.exitCode).toBe(0);
    fileExists(join(dir, 'AGENTS.md'));
    fileContains(join(dir, 'AGENTS.md'), '.agents/skills/post-feature-qa/');
  });
});
