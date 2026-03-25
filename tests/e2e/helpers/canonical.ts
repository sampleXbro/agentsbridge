import { cpSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject } from './setup.js';

export const FULL_FEATURES_CONFIG = `version: 1
targets:
  - claude-code
  - cursor
  - copilot
  - gemini-cli
  - cline
  - codex-cli
  - windsurf
features:
  - rules
  - commands
  - agents
  - skills
  - mcp
  - hooks
  - ignore
  - permissions
`;

export function createCanonicalProject(config = FULL_FEATURES_CONFIG): string {
  const dir = createTestProject();
  cpSync(
    join(process.cwd(), 'tests', 'e2e', 'fixtures', 'canonical-full', '.agentsbridge'),
    join(dir, '.agentsbridge'),
    { recursive: true },
  );
  writeFileSync(join(dir, 'agentsbridge.yaml'), config);
  return dir;
}

export function writeConfig(dir: string, content: string): void {
  writeFileSync(join(dir, 'agentsbridge.yaml'), content);
}
