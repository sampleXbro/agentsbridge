import type { CanonicalFiles } from '../../../core/types.js';
import { GEMINI_COMMANDS_DIR } from '../constants.js';
import { canonicalCommandNameToGeminiTomlPath } from '../command-namespace.js';
import type { RulesOutput } from './types.js';

function serializeTomlMultilineLiteral(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  if (!normalized.includes('"""')) {
    return `"""\n${normalized}\n"""`;
  }
  return JSON.stringify(normalized);
}

function serializeGeminiCommand(cmd: CanonicalFiles['commands'][number]): string {
  const lines = [
    `description = ${JSON.stringify(cmd.description || cmd.name)}`,
    `prompt = ${serializeTomlMultilineLiteral(cmd.body.trim() || '')}`,
  ];
  return lines.join('\n') + '\n';
}

export function generateCommands(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.commands.map((cmd) => ({
    path: canonicalCommandNameToGeminiTomlPath(cmd.name, GEMINI_COMMANDS_DIR),
    content: serializeGeminiCommand(cmd),
  }));
}
