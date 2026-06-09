/**
 * Per-subcommand usage signatures and worked examples for `agentsmesh lessons`.
 *
 * Single source of truth: the focused `lessons <sub> --help` view
 * (`printCommandHelp`) and the add-handler error hints both render from here, so
 * a usage string and its example can never drift apart. A fresh agent that
 * mis-calls a subcommand should land on the exact correct shape in one shot
 * rather than re-deriving it from the combined flag wall.
 */
export interface LessonsSubcommandUsage {
  /** One-line signature, brackets for optional, `...` for repeatable flags. */
  readonly usage: string;
  /** A filled-in, copy-pasteable invocation. */
  readonly example: string;
}

export const LESSONS_USAGE: Record<string, LessonsSubcommandUsage> = {
  query: {
    usage:
      'agentsmesh lessons query [--file <path>] [--cmd <command>] [--keyword <text>] [--top <n>] [--all] [--format plain|md|json]',
    example: 'agentsmesh lessons query --file src/app/page.tsx --cmd "git commit -m wip"',
  },
  add: {
    usage:
      'agentsmesh lessons add "<rule>" --topic <id> [--trigger-file <glob>]... [--trigger-cmd <regex>]... [--trigger-kw <text>]... [--evidence <ref>]... [--new-topic --topic-summary "..."]',
    example:
      'agentsmesh lessons add "Run tsc --noEmit before committing type changes" --topic build --trigger-file "src/**/*.ts" --evidence commit:abc1234',
  },
  deprecate: {
    usage: 'agentsmesh lessons deprecate <id> [--superseded-by <id>]',
    example: 'agentsmesh lessons deprecate build-old-rule --superseded-by build-new-rule',
  },
  merge: {
    usage: 'agentsmesh lessons merge <loser-id> <keeper-id>',
    example: 'agentsmesh lessons merge build-duplicate build-canonical',
  },
  untrigger: {
    usage: 'agentsmesh lessons untrigger <lesson-id> <trigger-id>',
    example: 'agentsmesh lessons untrigger build-old-rule t-kw-8bdcf7aa',
  },
};

/** Multi-line usage + example hint appended to add-handler errors. */
export function lessonsAddHint(): string {
  const add = LESSONS_USAGE.add!;
  return `\nUsage: ${add.usage}\nExample: ${add.example}`;
}
