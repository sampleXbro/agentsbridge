import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { createCanonicalProject } from './helpers/canonical.js';
import { runCli } from './helpers/run-cli.js';
import { cleanup } from './helpers/setup.js';
import {
  fileContains,
  fileExists,
  fileNotExists,
  readJson,
  readText,
} from './helpers/assertions.js';

describe('gemini-cli content contract roundtrip', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('generates gemini files in documented format and round-trips back to canonical', async () => {
    dir = createCanonicalProject();

    const generate = await runCli('generate --targets gemini-cli', dir);
    expect(generate.exitCode, generate.stderr).toBe(0);

    const rootPath = join(dir, 'GEMINI.md');
    const agentsCompatPath = join(dir, 'AGENTS.md');
    const settingsPath = join(dir, '.gemini', 'settings.json');
    const commandPath = join(dir, '.gemini', 'commands', 'review.toml');
    const agentPath = join(dir, '.gemini', 'agents', 'code-reviewer.md');
    // Gemini's Workspace policy tier is non-functional upstream, so permissions are
    // emitted only at global scope (see tests/e2e/global-roundtrip-gemini.e2e.test.ts).
    const policyPath = join(dir, '.gemini', 'policies', 'permissions.toml');

    fileExists(rootPath);
    fileExists(agentsCompatPath);
    fileExists(settingsPath);
    fileExists(commandPath);
    fileExists(agentPath);
    fileNotExists(policyPath);

    fileContains(commandPath, 'description = "Code review"');
    fileContains(commandPath, 'prompt = """');
    expect(readText(commandPath)).not.toContain('\n---\n');

    const settings = readJson(settingsPath);
    const context = settings.context as { fileName?: string[] } | undefined;
    expect(context?.fileName).toEqual(['GEMINI.md', 'AGENTS.md']);
    expect((settings.experimental as { enableAgents?: boolean } | undefined)?.enableAgents).toBe(
      true,
    );

    fileContains(agentPath, 'kind: local');
    fileContains(agentPath, 'maxTurns: 10');
    fileContains(agentPath, 'permissionMode: ask');

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    const imported = await runCli('import --from gemini-cli', dir);
    expect(imported.exitCode, imported.stderr).toBe(0);

    fileContains(join(dir, '.agentsmesh', 'rules', '_root.md'), '# Standards');
    fileContains(join(dir, '.agentsmesh', 'commands', 'review.md'), 'Review current changes');
    fileContains(join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'), 'maxTurns: 10');
    fileContains(join(dir, '.agentsmesh', 'agents', 'code-reviewer.md'), 'permissionMode: ask');
  });
});
