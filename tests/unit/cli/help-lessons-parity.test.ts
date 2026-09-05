import { describe, it, expect } from 'vitest';
import { COMMANDS } from '../../../src/cli/help-data.js';
import {
  GLOBAL_FLAGS,
  LESSONS_KNOWN_FLAGS,
} from '../../../src/cli/commands/lessons-known-flags.js';

/** `command` is an undocumented alias of `--cmd`; it is deliberately absent from help. */
const ALIASES = new Set(['command']);

function helpFlagNames(): Set<string> {
  const entry = COMMANDS.find((c) => c.name === 'lessons');
  if (entry === undefined) throw new Error('lessons help entry missing');
  const names = new Set<string>();
  for (const flag of entry.flags) {
    for (const match of flag.name.matchAll(/--([a-z][a-z0-9-]*)/g)) names.add(match[1]!);
  }
  return names;
}

describe('lessons help table parity', () => {
  it('documents every flag the lessons subcommands accept', () => {
    const documented = helpFlagNames();
    const missing = Object.entries(LESSONS_KNOWN_FLAGS).flatMap(([sub, flags]) =>
      flags
        .filter((f) => !documented.has(f) && !ALIASES.has(f) && !GLOBAL_FLAGS.includes(f))
        .map((f) => `${sub}: --${f}`),
    );
    expect(missing).toEqual([]);
  });

  it('documents no flag that no subcommand accepts', () => {
    const known = new Set([...Object.values(LESSONS_KNOWN_FLAGS).flat(), ...GLOBAL_FLAGS]);
    const unknown = [...helpFlagNames()].filter((f) => !known.has(f));
    expect(unknown).toEqual([]);
  });
});
