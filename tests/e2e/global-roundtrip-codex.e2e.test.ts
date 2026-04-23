import { describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { dirFilesExactly, fileContains, fileExists, readText } from './helpers/assertions.js';
import { markdownFrontmatter, markdownHasNoFrontmatter, validToml } from './helpers/file-shape.js';
import { useGlobalEnv } from './helpers/global-roundtrip-setup.js';

describe('global mode round-trip: Codex CLI', () => {
  const env = useGlobalEnv();

  it('canonical → generate --global → import --global → matches canonical', async () => {
    const { homeDir, canonicalDir, projectDir } = env;
    mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'agents'), { recursive: true });
    mkdirSync(join(canonicalDir, 'skills', 'codex-skill', 'references'), { recursive: true });

    writeFileSync(
      join(canonicalDir, 'rules', '_root.md'),
      '---\ndescription: Root\n---\n# Root\nCodex instructions\n',
    );
    writeFileSync(
      join(canonicalDir, 'rules', 'policy.md'),
      '---\ndescription: Policy\ncodex_emit: execution\n---\n# Policy\nAlways verify diffs\n',
    );
    writeFileSync(
      join(canonicalDir, 'agents', 'helper.md'),
      '---\ndescription: Helper\n---\n# Helper\nHelps with tasks\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'codex-skill', 'SKILL.md'),
      '---\ndescription: Codex skill\n---\n# Codex Skill\nCodex helper\n',
    );
    writeFileSync(
      join(canonicalDir, 'skills', 'codex-skill', 'references', 'manual.md'),
      '# Manual\nVerify carefully.\n',
    );
    writeFileSync(
      join(canonicalDir, 'mcp.json'),
      '{"mcpServers":{"test":{"command":"node","args":[]}}}',
    );
    writeFileSync(
      join(canonicalDir, 'agentsmesh.yaml'),
      'version: 1\ntargets: [codex-cli]\nfeatures: [rules, agents, skills, mcp]\n',
    );

    const gen = await runCli('generate --global --targets codex-cli', projectDir);
    expect(gen.exitCode).toBe(0);

    fileContains(join(homeDir, '.codex', 'AGENTS.md'), 'Codex instructions');
    markdownHasNoFrontmatter(join(homeDir, '.codex', 'AGENTS.md'));
    validToml(join(homeDir, '.codex', 'config.toml'));
    expect(readText(join(homeDir, '.codex', 'config.toml'))).toContain('[mcp_servers.test]');
    fileContains(join(homeDir, '.codex', 'agents', 'helper.toml'), 'Helps with tasks');
    validToml(join(homeDir, '.codex', 'agents', 'helper.toml'));
    fileContains(join(homeDir, '.codex', 'rules', 'policy.rules'), 'Always verify diffs');
    expect(
      markdownFrontmatter(join(homeDir, '.agents', 'skills', 'codex-skill', 'SKILL.md')).name,
    ).toBe('codex-skill');
    fileExists(join(homeDir, '.agents', 'skills', 'codex-skill', 'references', 'manual.md'));
    dirFilesExactly(join(homeDir, '.codex'), [
      'AGENTS.md',
      'agents/helper.toml',
      'config.toml',
      'rules/policy.rules',
    ]);
    dirFilesExactly(join(homeDir, '.agents'), [
      'skills/codex-skill/SKILL.md',
      'skills/codex-skill/references/manual.md',
    ]);

    rmSync(canonicalDir, { recursive: true, force: true });
    mkdirSync(canonicalDir, { recursive: true });

    const imp = await runCli('import --global --from codex-cli', projectDir);
    expect(imp.exitCode).toBe(0);

    fileContains(join(canonicalDir, 'rules', '_root.md'), 'Codex instructions');
    fileContains(join(canonicalDir, 'rules', 'policy.md'), 'Always verify diffs');
    fileContains(join(canonicalDir, 'agents', 'helper.md'), 'Helps with tasks');
    fileExists(join(canonicalDir, 'skills', 'codex-skill', 'SKILL.md'));
    fileExists(join(canonicalDir, 'skills', 'codex-skill', 'references', 'manual.md'));
    fileExists(join(canonicalDir, 'mcp.json'));
  });
});
