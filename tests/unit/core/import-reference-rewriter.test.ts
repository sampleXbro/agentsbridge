import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createImportReferenceNormalizer } from '../../../src/core/reference/import-rewriter.js';

const TEST_DIR = join(tmpdir(), 'am-import-reference-rewriter-test');

describe('createImportReferenceNormalizer', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.claude', 'commands'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.claude', 'agents'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.claude', 'skills', 'api-gen', 'references'), { recursive: true });

    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'typescript.md'), '# TS\n');
    writeFileSync(join(TEST_DIR, '.claude', 'commands', 'review.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.claude', 'agents', 'reviewer.md'), '# Reviewer\n');
    writeFileSync(join(TEST_DIR, '.claude', 'skills', 'api-gen', 'SKILL.md'), '# Skill\n');
    writeFileSync(
      join(TEST_DIR, '.claude', 'skills', 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );
    mkdirSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.agents', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.agents',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
    mkdirSync(join(TEST_DIR, '.windsurf', 'skills', 'post-feature-qa', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.windsurf', 'skills', 'post-feature-qa', 'SKILL.md'), '# QA\n');
    writeFileSync(
      join(
        TEST_DIR,
        '.windsurf',
        'skills',
        'post-feature-qa',
        'references',
        'edge-case-checklist.md',
      ),
      '# Edge Cases\n',
    );
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('normalizes target-specific paths across common token wrappers', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const content = [
      'Plain: .claude/rules/typescript.md.',
      'Markdown: [.claude/rules/typescript.md](.claude/rules/typescript.md).',
      'Mention: @.claude/commands/review.md.',
      'Quoted: ".claude/agents/reviewer.md".',
      'Parenthesized: (.claude/skills/api-gen/SKILL.md).',
      'Angle: <.claude/skills/api-gen/references/checklist.md>.',
      'Dir: .claude/skills/api-gen/references and .claude/skills/api-gen/references/.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('Plain: typescript.md.');
    expect(normalized).toContain('Markdown: [typescript.md](typescript.md).');
    expect(normalized).toContain('Mention: @../commands/review.md.');
    expect(normalized).toContain('Quoted: "../agents/reviewer.md".');
    expect(normalized).toContain('Parenthesized: (../skills/api-gen/SKILL.md).');
    expect(normalized).toContain('<../skills/api-gen/references/checklist.md>.');
    expect(normalized).toContain(
      'Dir: ../skills/api-gen/references and ../skills/api-gen/references/.',
    );
  });

  it('normalizes Claude global paths back to canonical paths during global import', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR, 'global');
    const normalized = normalize(
      'Use .claude/skills/api-gen/references/checklist.md and .claude/rules/typescript.md.',
      join(TEST_DIR, '.claude', 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe('Use ../skills/api-gen/references/checklist.md and typescript.md.');
  });

  it('normalizes Antigravity global paths back to canonical paths during global import', async () => {
    mkdirSync(join(TEST_DIR, '.gemini', 'antigravity', 'skills', 'api-gen', 'references'), {
      recursive: true,
    });
    writeFileSync(join(TEST_DIR, '.gemini', 'antigravity', 'GEMINI.md'), '# Root\n');
    writeFileSync(
      join(TEST_DIR, '.gemini', 'antigravity', 'skills', 'api-gen', 'SKILL.md'),
      '# Skill\n',
    );
    writeFileSync(
      join(TEST_DIR, '.gemini', 'antigravity', 'skills', 'api-gen', 'references', 'checklist.md'),
      '# Checklist\n',
    );

    const normalize = await createImportReferenceNormalizer('antigravity', TEST_DIR, 'global');
    const normalized = normalize(
      'Use .gemini/antigravity/GEMINI.md and .gemini/antigravity/skills/api-gen/references/checklist.md.',
      join(TEST_DIR, '.gemini', 'antigravity', 'GEMINI.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe('Use _root.md and ../skills/api-gen/references/checklist.md.');
  });

  it('normalizes Codex global paths back to canonical paths during global import', async () => {
    mkdirSync(join(TEST_DIR, '.codex'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.codex', 'AGENTS.md'), '# Root\n');

    const normalize = await createImportReferenceNormalizer('codex-cli', TEST_DIR, 'global');
    const normalized = normalize(
      'Use .codex/AGENTS.md and .agents/skills/post-feature-qa/references/edge-case-checklist.md.',
      join(TEST_DIR, '.codex', 'AGENTS.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use _root.md and ../skills/post-feature-qa/references/edge-case-checklist.md.',
    );
  });

  it('prefers longer path matches before parent directory mappings', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const normalized = normalize(
      'Use .claude/skills/api-gen/references/checklist.md from .claude/skills/api-gen/references/.',
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use ../skills/api-gen/references/checklist.md from ../skills/api-gen/references/.',
    );
  });

  it('leaves unrelated relative and absolute paths untouched', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const content = [
      'Relative: ../commands/review.md',
      'Absolute: /tmp/project/.agentsmesh/commands/review.md',
      'Target: .claude/commands/review.md',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('Relative: ../commands/review.md');
    expect(normalized).toContain('Absolute: /tmp/project/.agentsmesh/commands/review.md');
    expect(normalized).toContain('Target: ../commands/review.md');
  });

  it('normalizes target-specific inline-code file references while preserving fenced code blocks', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const normalized = normalize(
      ['Inline: `.claude/commands/review.md`.', '```', '.claude/commands/review.md', '```'].join(
        '\n',
      ),
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('Inline: `../commands/review.md`.');
    expect(normalized).toContain('```\n.claude/commands/review.md\n```');
  });

  it('normalizes cline root rule references from .clinerules paths', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', 'typescript.md'), '# TS\n');

    const normalize = await createImportReferenceNormalizer('cline', TEST_DIR);
    const normalized = normalize(
      'See .clinerules/typescript.md.',
      join(TEST_DIR, '.clinerules', '_root.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe('See typescript.md.');
  });

  it('normalizes .clinerules/_root.md reference to canonical _root.md path', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', '_root.md'), '# Root\n');

    const normalize = await createImportReferenceNormalizer('cline', TEST_DIR);
    const normalized = normalize(
      'See .clinerules/_root.md for global rules.',
      join(TEST_DIR, '.clinerules', 'typescript.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', 'typescript.md'),
    );

    expect(normalized).toBe('See _root.md for global rules.');
  });

  it('normalizes cline paths when source file is AGENTS.md (fallback import)', async () => {
    mkdirSync(join(TEST_DIR, '.clinerules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.clinerules', 'typescript.md'), '# TS\n');
    mkdirSync(join(TEST_DIR, '.cline', 'skills', 'qa'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cline', 'skills', 'qa', 'SKILL.md'), '# QA\n');

    const normalize = await createImportReferenceNormalizer('cline', TEST_DIR);
    const normalized = normalize(
      ['Rule: .clinerules/typescript.md.', 'Skill: .cline/skills/qa/SKILL.md.'].join('\n'),
      join(TEST_DIR, 'AGENTS.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('typescript.md');
    expect(normalized).toContain('../skills/qa/SKILL.md');
    expect(normalized).not.toContain('.clinerules/typescript.md');
    expect(normalized).not.toContain('.cline/skills/qa/SKILL.md');
  });

  it('treats bare multi-segment paths as project-root-relative during import', async () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'AGENTS.md'), '# Scoped rule\n');

    const normalize = await createImportReferenceNormalizer('codex-cli', TEST_DIR);
    const normalized = normalize(
      'Canonical: src/AGENTS.md.',
      join(TEST_DIR, '.agents', 'skills', 'api-generator', 'SKILL.md'),
      join(TEST_DIR, '.agentsmesh', 'skills', 'api-generator', 'SKILL.md'),
    );

    expect(normalized).toBe('Canonical: ../../rules/src.md.');
  });

  it('normalizes codex-cli skill directory references back to canonical skill directories', async () => {
    const normalize = await createImportReferenceNormalizer('codex-cli', TEST_DIR);
    const normalized = normalize(
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.',
      join(TEST_DIR, 'AGENTS.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use `../skills/post-feature-qa/` and `../skills/post-feature-qa/references/edge-case-checklist.md`.',
    );
  });

  it('normalizes codex-cli skill directory references even when importing from cline', async () => {
    const normalize = await createImportReferenceNormalizer('cline', TEST_DIR);
    const normalized = normalize(
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.',
      join(TEST_DIR, '.clinerules', '_root.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use `../skills/post-feature-qa/` and `../skills/post-feature-qa/references/edge-case-checklist.md`.',
    );
  });

  it('normalizes codex-cli skill directory references even when importing from claude-code', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const normalized = normalize(
      'Use `.agents/skills/post-feature-qa/` and `.agents/skills/post-feature-qa/references/edge-case-checklist.md`.',
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use `../skills/post-feature-qa/` and `../skills/post-feature-qa/references/edge-case-checklist.md`.',
    );
  });

  it('normalizes windsurf skill directory references back to canonical skill directories', async () => {
    const normalize = await createImportReferenceNormalizer('windsurf', TEST_DIR);
    const normalized = normalize(
      'Use `.windsurf/skills/post-feature-qa/` and `.windsurf/skills/post-feature-qa/references/edge-case-checklist.md`.',
      join(TEST_DIR, 'AGENTS.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toBe(
      'Use `../skills/post-feature-qa/` and `../skills/post-feature-qa/references/edge-case-checklist.md`.',
    );
  });

  it('normalizes target-specific Windows-style and mixed-separator paths during import', async () => {
    const normalize = await createImportReferenceNormalizer('claude-code', TEST_DIR);
    const content = [
      'Backslash: .claude\\commands\\review.md.',
      'Mixed: .claude\\agents/reviewer.md.',
      'Skill: .claude\\skills\\api-gen\\references/checklist.md.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, 'CLAUDE.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('Backslash: ../commands/review.md.');
    expect(normalized).toContain('Mixed: ../agents/reviewer.md.');
    expect(normalized).toContain('Skill: ../skills/api-gen/references/checklist.md.');
  });

  it('normalizes cursor target-specific paths to canonical form', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.cursor', 'commands'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.cursor', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.cursor', 'rules', 'typescript.mdc'), '# TS\n');
    writeFileSync(join(TEST_DIR, '.cursor', 'commands', 'review.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.cursor', 'skills', 'api-gen', 'SKILL.md'), '# Skill\n');

    const normalize = await createImportReferenceNormalizer('cursor', TEST_DIR);
    const content = [
      'Rule: .cursor/rules/typescript.mdc.',
      'Command: .cursor/commands/review.md.',
      'Skill: .cursor/skills/api-gen/SKILL.md.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, '.cursor', 'rules', '_root.mdc'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('typescript.md.');
    expect(normalized).toContain('../commands/review.md.');
    expect(normalized).toContain('../skills/api-gen/SKILL.md.');
  });

  it('normalizes copilot target-specific paths to canonical form', async () => {
    mkdirSync(join(TEST_DIR, '.github', 'instructions'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.github', 'prompts'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.github', 'agents'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.github', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.github', 'copilot-instructions.md'), '# Root\n');
    writeFileSync(
      join(TEST_DIR, '.github', 'instructions', 'typescript.instructions.md'),
      '# TS\n',
    );
    writeFileSync(join(TEST_DIR, '.github', 'prompts', 'review.prompt.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.github', 'agents', 'reviewer.agent.md'), '# Agent\n');
    writeFileSync(join(TEST_DIR, '.github', 'skills', 'api-gen', 'SKILL.md'), '# Skill\n');

    const normalize = await createImportReferenceNormalizer('copilot', TEST_DIR);
    const content = [
      'Root: .github/copilot-instructions.md.',
      'Rule: .github/instructions/typescript.instructions.md.',
      'Prompt: .github/prompts/review.prompt.md.',
      'Agent: .github/agents/reviewer.agent.md.',
      'Skill: .github/skills/api-gen/SKILL.md.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, '.github', 'copilot-instructions.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('typescript.md.');
    expect(normalized).toContain('_root.md.');
    expect(normalized).toContain('../commands/review.md.');
    expect(normalized).toContain('../agents/reviewer.md.');
    expect(normalized).toContain('../skills/api-gen/SKILL.md.');
  });

  it('normalizes gemini-cli target-specific paths to canonical form', async () => {
    mkdirSync(join(TEST_DIR, '.gemini', 'rules'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.gemini', 'commands'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.gemini', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.gemini', 'rules', 'typescript.md'), '# TS\n');
    writeFileSync(join(TEST_DIR, '.gemini', 'commands', 'review.toml'), 'prompt = "Review"\n');
    writeFileSync(join(TEST_DIR, '.gemini', 'skills', 'api-gen', 'SKILL.md'), '# Skill\n');

    const normalize = await createImportReferenceNormalizer('gemini-cli', TEST_DIR);
    const content = [
      'Rule: .gemini/rules/typescript.md.',
      'Command: .gemini/commands/review.toml.',
      'Skill: .gemini/skills/api-gen/SKILL.md.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, 'GEMINI.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('typescript.md.');
    expect(normalized).toContain('../commands/review.md.');
    expect(normalized).toContain('../skills/api-gen/SKILL.md.');
  });

  it('normalizes windsurf target-specific paths to canonical form', async () => {
    mkdirSync(join(TEST_DIR, '.windsurf', 'rules'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.windsurf', 'workflows'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.windsurf', 'skills', 'api-gen'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.windsurf', 'rules', 'typescript.md'), '# TS\n');
    writeFileSync(join(TEST_DIR, '.windsurf', 'workflows', 'review.md'), '# Review\n');
    writeFileSync(join(TEST_DIR, '.windsurf', 'skills', 'api-gen', 'SKILL.md'), '# Skill\n');

    const normalize = await createImportReferenceNormalizer('windsurf', TEST_DIR);
    const content = [
      'Rule: .windsurf/rules/typescript.md.',
      'Workflow: .windsurf/workflows/review.md.',
      'Skill: .windsurf/skills/api-gen/SKILL.md.',
    ].join('\n');

    const normalized = normalize(
      content,
      join(TEST_DIR, 'AGENTS.md'),
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    );

    expect(normalized).toContain('typescript.md.');
    expect(normalized).toContain('../commands/review.md.');
    expect(normalized).toContain('../skills/api-gen/SKILL.md.');
  });
});
