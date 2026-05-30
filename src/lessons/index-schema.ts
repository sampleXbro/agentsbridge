import { z } from 'zod';

const TriggersSchema = z
  .object({
    file_globs: z.array(z.string()),
    command_patterns: z.array(z.string()),
    keywords: z.array(z.string()),
  })
  .refine((t) => t.file_globs.length + t.command_patterns.length + t.keywords.length > 0, {
    message: 'cluster must declare at least one trigger of any type',
  });

const ClusterSchema = z.object({
  topic: z.string().regex(/^[a-z0-9-]+$/, 'topic must be kebab-case'),
  /**
   * Project-relative path (forward slashes) to the cluster's markdown body.
   * Conventionally `.agentsmesh/lessons/topics/<topic>.md`, but any project
   * path is accepted — universal across every agent target.
   */
  file: z.string().regex(/\.md$/, 'file must be a .md path'),
  summary: z.string().min(1),
  triggers: TriggersSchema,
});

export const LessonsIndexSchema = z.object({
  version: z.literal(1),
  /**
   * Zero clusters is valid — supports `agentsmesh init --lessons` scaffolding a
   * fresh project. Topics accumulate via `distill:apply` as failures are
   * captured.
   */
  clusters: z.array(ClusterSchema),
});

export type LessonsIndex = z.infer<typeof LessonsIndexSchema>;
export type LessonsCluster = z.infer<typeof ClusterSchema>;

export function parseIndex(raw: unknown): LessonsIndex {
  return LessonsIndexSchema.parse(raw);
}
