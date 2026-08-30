/**
 * Amazon Q CLI saved prompts (`/prompts`) are the commands surface.
 *
 * `crates/chat-cli/src/util/paths.rs` defines workspace `PROMPTS_DIR = ".amazonq/prompts"`
 * and global `PROMPTS_DIR = ".aws/amazonq/prompts"`; `cli/chat/cli/prompts.rs` reads flat
 * `<name>.md` files (non-recursive, extension must be `md`) and pushes the whole file body
 * verbatim as the prompt text — no frontmatter, no argument substitution. Prompt names are
 * validated against `^[a-zA-Z0-9_-]+$` and capped at 50 characters.
 */
import { describe, it, expect } from 'vitest';
import { generateCommands } from '../../../../src/targets/amazon-q/generator.js';
import { lintCommands } from '../../../../src/targets/amazon-q/lint.js';
import { descriptor } from '../../../../src/targets/amazon-q/index.js';
import {
  AMAZON_Q_PROMPTS_DIR,
  AMAZON_Q_GLOBAL_PROMPTS_DIR,
} from '../../../../src/targets/amazon-q/constants.js';
import type { CanonicalCommand, CanonicalFiles } from '../../../../src/core/canonical-types.js';

function makeCommand(overrides: Partial<CanonicalCommand> = {}): CanonicalCommand {
  return {
    source: '.agentsmesh/commands/review.md',
    name: 'review',
    description: '',
    allowedTools: [],
    body: 'Review the diff.',
    ...overrides,
  };
}

function makeCanonical(commands: CanonicalCommand[]): CanonicalFiles {
  return {
    rules: [],
    commands,
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('amazon-q generateCommands', () => {
  it('writes a flat .md prompt file carrying the body verbatim', () => {
    const results = generateCommands(makeCanonical([makeCommand()]));
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${AMAZON_Q_PROMPTS_DIR}/review.md`);
    expect(results[0]!.content).toBe('Review the diff.');
  });

  it('emits no frontmatter even when the command has description and allowed-tools', () => {
    const results = generateCommands(
      makeCanonical([makeCommand({ description: 'Review a PR', allowedTools: ['Read', 'Grep'] })]),
    );
    expect(results[0]!.content).toBe('Review the diff.');
    expect(results[0]!.content.startsWith('---')).toBe(false);
  });

  it('flattens namespaced names — Q CLI does not scan prompt subdirectories', () => {
    const results = generateCommands(
      makeCanonical([makeCommand({ name: 'git:review', source: '.agentsmesh/commands/x.md' })]),
    );
    expect(results[0]!.path).toBe(`${AMAZON_Q_PROMPTS_DIR}/git-review.md`);
  });

  it('replaces characters outside ^[a-zA-Z0-9_-]+$ and truncates to 50 characters', () => {
    const results = generateCommands(
      makeCanonical([makeCommand({ name: `spa ce.${'x'.repeat(60)}` })]),
    );
    const base = results[0]!.path.slice(`${AMAZON_Q_PROMPTS_DIR}/`.length, -'.md'.length);
    expect(base).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(base.length).toBe(50);
    expect(base.startsWith('spa-ce-')).toBe(true);
  });

  it('returns [] when there are no canonical commands', () => {
    expect(generateCommands(makeCanonical([]))).toEqual([]);
  });
});

describe('amazon-q commands capability wiring', () => {
  it('declares commands native at both scopes', () => {
    expect(descriptor.capabilities.commands).toBe('native');
    expect(descriptor.globalSupport.capabilities.commands).toBe('native');
  });

  it('maps command paths through both layouts', () => {
    expect(descriptor.project.paths.commandPath('review', undefined as never)).toBe(
      `${AMAZON_Q_PROMPTS_DIR}/review.md`,
    );
    expect(descriptor.globalSupport.layout.paths.commandPath('review', undefined as never)).toBe(
      `${AMAZON_Q_GLOBAL_PROMPTS_DIR}/review.md`,
    );
  });

  it('rewrites project prompt paths to the global prompts dir', () => {
    const rewrite = descriptor.globalSupport.layout.rewriteGeneratedPath!;
    expect(rewrite(`${AMAZON_Q_PROMPTS_DIR}/review.md`)).toBe(
      `${AMAZON_Q_GLOBAL_PROMPTS_DIR}/review.md`,
    );
  });

  it('imports prompts from both scopes back into canonical commands', () => {
    const spec = descriptor.importer!.commands!;
    expect(spec.feature).toBe('commands');
    expect(spec.mode).toBe('directory');
    expect(spec.source.project).toEqual([AMAZON_Q_PROMPTS_DIR]);
    expect(spec.source.global).toEqual([AMAZON_Q_GLOBAL_PROMPTS_DIR]);
    expect(spec.extensions).toEqual(['.md']);
  });
});

describe('amazon-q lintCommands', () => {
  it('warns when a command carries metadata Q prompt files cannot express', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ description: 'Review a PR', allowedTools: ['Read'] })]),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.level).toBe('warning');
    expect(diagnostics[0]!.target).toBe('amazon-q');
    expect(diagnostics[0]!.file).toBe('.agentsmesh/commands/review.md');
  });

  it('warns when a command name has to be rewritten to satisfy Q prompt naming', () => {
    const diagnostics = lintCommands(makeCanonical([makeCommand({ name: 'git:review' })]));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('git-review');
  });

  it('is silent for a plain, already-valid command', () => {
    expect(lintCommands(makeCanonical([makeCommand()]))).toEqual([]);
  });

  it('warns when two commands collapse onto the same prompt filename', () => {
    // `git:review` sanitizes to `git-review`, colliding with a literal `git-review`.
    const diagnostics = lintCommands(
      makeCanonical([
        makeCommand({ name: 'git:review', source: '.agentsmesh/commands/a.md' }),
        makeCommand({ name: 'git-review', source: '.agentsmesh/commands/b.md' }),
      ]),
    );
    const collision = diagnostics.filter((d) => d.message.includes('same Amazon Q prompt file'));
    expect(collision).toHaveLength(2);
    expect(collision[0]!.message).toContain('git-review.md');
    expect(collision.map((d) => d.file).sort()).toEqual([
      '.agentsmesh/commands/a.md',
      '.agentsmesh/commands/b.md',
    ]);
  });

  it('does not report a collision for distinct names', () => {
    const diagnostics = lintCommands(
      makeCanonical([
        makeCommand({ name: 'review', source: '.agentsmesh/commands/a.md' }),
        makeCommand({ name: 'ship', source: '.agentsmesh/commands/b.md' }),
      ]),
    );
    expect(diagnostics).toEqual([]);
  });
});

describe('amazon-q generateCommands edge cases', () => {
  it('writes an empty file for a command with an empty body', () => {
    const results = generateCommands(makeCanonical([makeCommand({ body: '   \n' })]));
    expect(results[0]!.content).toBe('');
  });
});
