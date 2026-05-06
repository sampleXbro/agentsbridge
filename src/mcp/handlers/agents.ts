import { z } from 'zod';
import { createCanonicalHandlers, type CanonicalHandlers } from './canonical-factory.js';

const agentFrontmatter = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    tools: z.array(z.string()).optional(),
    model: z.string().optional(),
  })
  .passthrough();

export interface AgentSummary {
  name: string;
  description: string | null;
  tools: string[] | null;
  model: string | null;
}

export const agentsHandlers: CanonicalHandlers<AgentSummary> =
  createCanonicalHandlers<AgentSummary>({
    feature: 'agents',
    frontmatterSchema: agentFrontmatter,
    toSummary: (name, fm) => ({
      name,
      description: (fm.description as string | undefined) ?? null,
      tools: (fm.tools as string[] | undefined) ?? null,
      model: (fm.model as string | undefined) ?? null,
    }),
  });
