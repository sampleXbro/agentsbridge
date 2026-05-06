import { z } from 'zod';
import { createCanonicalHandlers, type CanonicalHandlers } from './canonical-factory.js';

const ruleFrontmatter = z
  .object({
    description: z.string().optional(),
    root: z.boolean().optional(),
    globs: z.array(z.string()).nullable().optional(),
    targets: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export interface RuleSummary {
  name: string;
  description: string | null;
  root: boolean;
  globs: string[] | null;
  targets: string[] | null;
}

export const rulesHandlers: CanonicalHandlers<RuleSummary> = createCanonicalHandlers<RuleSummary>({
  feature: 'rules',
  frontmatterSchema: ruleFrontmatter,
  toSummary: (name, fm) => ({
    name,
    description: (fm.description as string | undefined) ?? null,
    root: Boolean(fm.root),
    globs: (fm.globs as string[] | null | undefined) ?? null,
    targets: (fm.targets as string[] | null | undefined) ?? null,
  }),
});
