import { z } from 'zod';
import { createCanonicalHandlers, type CanonicalHandlers } from './canonical-factory.js';

const cmdFrontmatter = z
  .object({
    description: z.string().optional(),
    'allowed-tools': z.array(z.string()).optional(),
  })
  .passthrough();

export interface CommandSummary {
  name: string;
  description: string | null;
  allowedTools: string[] | null;
}

export const commandsHandlers: CanonicalHandlers<CommandSummary> =
  createCanonicalHandlers<CommandSummary>({
    feature: 'commands',
    frontmatterSchema: cmdFrontmatter,
    toSummary: (name, fm) => ({
      name,
      description: (fm.description as string | undefined) ?? null,
      allowedTools: (fm['allowed-tools'] as string[] | undefined) ?? null,
    }),
  });
