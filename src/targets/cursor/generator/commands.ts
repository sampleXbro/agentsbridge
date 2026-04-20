import type { CanonicalFiles } from '../../../core/types.js';
import { CURSOR_COMMANDS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => ({
    path: `${CURSOR_COMMANDS_DIR}/${cmd.name}.md`,
    content: cmd.body.trim() || '',
  }));
}
