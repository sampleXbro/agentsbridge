/**
 * Serialize a canonical agent to Factory Droid format.
 *
 * Factory Droid uses Markdown files with YAML frontmatter in `.factory/droids/`.
 * Required frontmatter fields: name (lowercase, digits, hyphens, underscores).
 * Optional fields: description (max 500 chars), model, tools.
 */

import type { CanonicalAgent } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/text/markdown.js';

export function serializeDroid(agent: CanonicalAgent): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
  };

  if (agent.description) {
    frontmatter.description = agent.description.slice(0, 500);
  }

  if (agent.model) {
    frontmatter.model = agent.model;
  } else {
    frontmatter.model = 'inherit';
  }

  if (agent.tools.length > 0) {
    frontmatter.tools = agent.tools;
  }

  return serializeFrontmatter(frontmatter, agent.body.trim() || '');
}
