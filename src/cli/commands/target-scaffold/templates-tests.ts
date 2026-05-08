/**
 * Test/fixture templates emitted by `agentsmesh target scaffold`.
 * Split from the main barrel to honor the 200-line file budget.
 */
import { toPascal, type TemplateVars } from './templates-shared.js';

export function TEMPLATE_GENERATOR_TEST(v: TemplateVars): string {
  return `import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateRules } from '../../../../src/targets/${v.id}/generator.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('generateRules (${v.id})', () => {
  it('returns an array', () => {
    const result = generateRules(makeCanonical());
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when no rules', () => {
    const result = generateRules(makeCanonical({ rules: [] }));
    expect(result).toHaveLength(0);
  });
});
`;
}

export function TEMPLATE_IMPORTER_TEST(v: TemplateVars): string {
  const pascal = toPascal(v.id);
  return `import { describe, it, expect } from 'vitest';
import { importFrom${pascal} } from '../../../../src/targets/${v.id}/importer.js';

describe('importFrom${pascal} (${v.id})', () => {
  it('returns an array', async () => {
    const result = await importFrom${pascal}('/tmp/stub-project');
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array by default', async () => {
    const result = await importFrom${pascal}('/tmp/stub-project', { scope: 'project' });
    expect(result).toHaveLength(0);
  });
});
`;
}

export function TEMPLATE_FIXTURE_ROOT_MD(v: TemplateVars): string {
  return `# ${v.displayName} Workspace

Follow the ${v.displayName} configuration files and keep changes small.
`;
}
