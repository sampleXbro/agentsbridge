import type { CanonicalFiles } from '../../../core/types.js';
import { serializeFrontmatter } from '../../../utils/text/markdown.js';
import { WINDSURF_WORKFLOWS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => {
    const frontmatter: Record<string, unknown> = {
      description: cmd.description.trim() || undefined,
      allowedTools: cmd.allowedTools.length > 0 ? cmd.allowedTools : undefined,
    };
    Object.keys(frontmatter).forEach((key) => {
      if (frontmatter[key] === undefined) delete frontmatter[key];
    });
    const content =
      Object.keys(frontmatter).length > 0
        ? serializeFrontmatter(frontmatter, cmd.body.trim() || '')
        : cmd.body.trim();
    return {
      path: `${WINDSURF_WORKFLOWS_DIR}/${cmd.name}.md`,
      content,
    };
  });
}
