import { basename } from 'node:path';
import type { CanonicalCommand } from '../../core/types.js';
import { serializeFrontmatter } from '../../utils/markdown.js';
import { COPILOT_PROMPTS_DIR } from './constants.js';

interface ParsedCommandPrompt {
  name: string;
  description: string;
  allowedTools: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function commandPromptPath(name: string): string {
  return `${COPILOT_PROMPTS_DIR}/${name}.prompt.md`;
}

export function serializeCommandPrompt(command: CanonicalCommand): string {
  const frontmatter: Record<string, unknown> = {
    agent: 'agent',
    description: command.description || undefined,
    'x-agentsbridge-kind': 'command',
    'x-agentsbridge-name': command.name,
    'x-agentsbridge-allowed-tools':
      command.allowedTools.length > 0 ? command.allowedTools : undefined,
  };
  if (frontmatter.description === undefined) delete frontmatter.description;
  if (frontmatter['x-agentsbridge-allowed-tools'] === undefined) {
    delete frontmatter['x-agentsbridge-allowed-tools'];
  }
  return serializeFrontmatter(frontmatter, command.body.trim() || '');
}

export function parseCommandPromptFrontmatter(
  frontmatter: Record<string, unknown>,
  promptPath: string,
): ParsedCommandPrompt {
  const nameFromMetadata =
    typeof frontmatter['x-agentsbridge-name'] === 'string'
      ? frontmatter['x-agentsbridge-name']
      : '';
  const name = (nameFromMetadata || basename(promptPath, '.prompt.md')).trim();
  const allowedToolsFromMetadata = toStringArray(frontmatter['x-agentsbridge-allowed-tools']);
  const allowedTools =
    allowedToolsFromMetadata.length > 0
      ? allowedToolsFromMetadata
      : toStringArray(frontmatter.tools);

  return {
    name,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    allowedTools,
  };
}

export function serializeImportedCommand(command: ParsedCommandPrompt, body: string): string {
  const frontmatter: Record<string, unknown> = {
    description: command.description || undefined,
    'allowed-tools': command.allowedTools.length > 0 ? command.allowedTools : undefined,
  };
  if (frontmatter.description === undefined) delete frontmatter.description;
  if (frontmatter['allowed-tools'] === undefined) delete frontmatter['allowed-tools'];
  return serializeFrontmatter(frontmatter, body.trim() || '');
}
