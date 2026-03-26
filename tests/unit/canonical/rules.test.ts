import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRules } from '../../../src/canonical/rules.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-rules-test');
const RULES_DIR = join(TEST_DIR, '.agentsmesh', 'rules');

beforeEach(() => {
  mkdirSync(RULES_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeRule(filename: string, content: string): void {
  writeFileSync(join(RULES_DIR, filename), content);
}

describe('parseRules', () => {
  it('parses single rule with frontmatter', async () => {
    writeRule(
      'typescript.md',
      `---
description: "TypeScript rules"
globs: "src/**/*.ts"
targets: ["claude-code", "cursor"]
---

# TypeScript

Use strict mode.`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      source: expect.stringContaining('typescript.md'),
      root: false,
      description: 'TypeScript rules',
      globs: ['src/**/*.ts'],
      targets: ['claude-code', 'cursor'],
      body: expect.stringContaining('Use strict mode'),
    });
  });

  it('detects _root.md as root rule', async () => {
    writeRule(
      '_root.md',
      `---
description: "Project rules"
---

# Root

Always apply.`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.root).toBe(true);
    expect(rules[0]?.body).toContain('Always apply');
  });

  it('parses root from frontmatter when not _root filename', async () => {
    writeRule(
      'main.md',
      `---
root: true
description: "Main"
---

Body`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.root).toBe(true);
  });

  it('parses multiple rules', async () => {
    writeRule(
      '_root.md',
      `---
description: "Root"
---
Root body`,
    );
    writeRule(
      'typescript.md',
      `---
globs: ["src/**/*.ts"]
---
TS body`,
    );
    writeRule(
      'testing.md',
      `---
description: Testing
---
Test body`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules).toHaveLength(3);
    const root = rules.find((r) => r.root);
    expect(root).toBeDefined();
    expect(root?.body).toContain('Root body');
    const ts = rules.find((r) => r.globs.includes('src/**/*.ts'));
    expect(ts?.body).toContain('TS body');
  });

  it('normalizes globs string to array', async () => {
    writeRule(
      'single.md',
      `---
globs: "*.ts"
---

Body`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.globs).toEqual(['*.ts']);
  });

  it('normalizes targets string to array', async () => {
    writeRule(
      'cursor-only.md',
      `---
targets: "cursor"
---

Body`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.targets).toEqual(['cursor']);
  });

  it('handles empty string targets (returns empty array)', async () => {
    writeRule('empty-targets.md', `---\ntargets: ""\n---\n\nBody`);
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.targets).toEqual([]);
  });

  it('handles non-string, non-array targets (returns empty array)', async () => {
    writeRule('null-targets.md', `---\ntargets: 42\n---\n\nBody`);
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.targets).toEqual([]);
  });

  it('sets root from frontmatter when root: true (not just filename)', async () => {
    writeRule(
      'explicit-root.md',
      `---\nroot: true\ndescription: "Explicit root"\n---\n\nRoot content.`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.root).toBe(true);
  });

  it('returns empty array for non-existent directory', async () => {
    const rules = await parseRules(join(TEST_DIR, 'nope'));
    expect(rules).toEqual([]);
  });

  it('returns empty array for empty rules directory', async () => {
    const rules = await parseRules(RULES_DIR);
    expect(rules).toEqual([]);
  });

  it('uses defaults when frontmatter minimal', async () => {
    writeRule('minimal.md', `# Just body`);
    const rules = await parseRules(RULES_DIR);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      root: false,
      targets: [],
      description: '',
      globs: [],
      body: expect.stringContaining('Just body'),
    });
  });

  it('ignores non-.md files', async () => {
    writeRule(
      'typescript.md',
      `---
description: TS
---
Body`,
    );
    writeFileSync(join(RULES_DIR, 'readme.txt'), 'not a rule');
    const rules = await parseRules(RULES_DIR);
    expect(rules).toHaveLength(1);
  });

  it('parses trigger: model_decision from frontmatter', async () => {
    writeRule(
      'model-decide.md',
      `---
description: AI-decided rule
trigger: model_decision
---

Use when relevant.`,
    );
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.trigger).toBe('model_decision');
  });

  it('parses trigger: manual from frontmatter', async () => {
    writeRule('manual.md', '---\ntrigger: manual\n---\n\nManual rule.');
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.trigger).toBe('manual');
  });

  it('leaves trigger undefined when not in frontmatter', async () => {
    writeRule('no-trigger.md', '---\ndescription: No trigger\n---\n\nBody.');
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.trigger).toBeUndefined();
  });

  it('leaves trigger undefined for invalid trigger value', async () => {
    writeRule('bad-trigger.md', '---\ntrigger: bogus_value\n---\n\nBody.');
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.trigger).toBeUndefined();
  });

  it('parses codex_emit: execution', async () => {
    writeRule('exec.md', '---\ncodex_emit: execution\n---\n\nprefix_rule()');
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.codexEmit).toBe('execution');
  });

  it('parses codex_instruction: override', async () => {
    writeRule('ov.md', '---\ncodex_instruction: override\n---\n\nBody.');
    const rules = await parseRules(RULES_DIR);
    expect(rules[0]?.codexInstructionVariant).toBe('override');
  });
});
