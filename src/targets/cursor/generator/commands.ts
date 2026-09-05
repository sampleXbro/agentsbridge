import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { CURSOR_COMMANDS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

/**
 * Cursor command files accept `name`/`description` frontmatter (cursor.com/docs/reference/plugins);
 * `description` is emitted so import round-trips it. `allowed-tools` has no Cursor field.
 */
export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => {
    const frontmatter: Record<string, unknown> = {};
    if (cmd.description) frontmatter.description = cmd.description;
    return {
      path: `${CURSOR_COMMANDS_DIR}/${cmd.name}.md`,
      content: serializeFrontmatter(frontmatter, cmd.body.trim() || ''),
    };
  });
}
