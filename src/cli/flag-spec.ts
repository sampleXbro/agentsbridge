/**
 * Which flags take a value, per command, derived from the help table so the
 * parser and `--help` can never disagree. A flag takes a value when its help
 * name shows one (`--targets <csv>`, `--format plain|md|json`, `--scope always`);
 * a bare `--dry-run` is boolean. Global flags are booleans unless a command
 * redefines them (`plugin add --version <v>`).
 */
import { COMMANDS, GLOBAL_FLAGS } from './help-data.js';

const specCache = new Map<string, ReadonlyMap<string, boolean>>();

function addHelpName(name: string, into: Map<string, boolean>): void {
  const tokens = name.split(/\s+/);
  tokens.forEach((token, i) => {
    if (!token.startsWith('--')) return;
    const next = tokens[i + 1];
    into.set(token.slice(2), next !== undefined && !next.startsWith('--'));
  });
}

/** Flag name (without dashes) -> takes a value. */
export function flagSpecs(command: string): ReadonlyMap<string, boolean> {
  const cached = specCache.get(command);
  if (cached !== undefined) return cached;
  const specs = new Map<string, boolean>();
  for (const flag of GLOBAL_FLAGS) addHelpName(flag.name, specs);
  for (const flag of COMMANDS.find((c) => c.name === command)?.flags ?? []) {
    addHelpName(flag.name, specs);
  }
  specCache.set(command, specs);
  return specs;
}

/** true = value flag, false = boolean flag, undefined = unknown to the help table. */
export function flagTakesValue(command: string, flag: string): boolean | undefined {
  return flagSpecs(command).get(flag);
}
