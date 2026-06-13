/**
 * Compose MCP tool/resource descriptors. Per-category tool tables live in
 * `tool-tables/` to keep this barrel under the project's 200-line file
 * budget (CLAUDE.md).
 */
import type { z } from 'zod';
import { toJSONSchema } from 'zod/v4/core';
import { CANONICAL_TOOL_DESCRIPTORS } from './tool-tables/canonical-tools.js';
import { SKILL_TOOL_DESCRIPTORS } from './tool-tables/skill-tools.js';
import { SETTINGS_TOOL_DESCRIPTORS } from './tool-tables/settings-tools.js';
import { ORCHESTRATE_TOOL_DESCRIPTORS } from './tool-tables/orchestrate-tools.js';
import { INSTALL_TOOL_DESCRIPTORS } from './tool-tables/install-tools.js';
import { LESSONS_TOOL_DESCRIPTORS } from './tool-tables/lessons-tools.js';
import type { ResourceDescriptor, ToolDescriptor } from './tool-tables/types.js';

export type { ToolDescriptor, ResourceDescriptor } from './tool-tables/types.js';

export function zodToMcpSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = toJSONSchema(schema, { target: 'draft-07' }) as Record<string, unknown>;
  delete json['$schema'];
  return json;
}

export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  ...CANONICAL_TOOL_DESCRIPTORS,
  ...SKILL_TOOL_DESCRIPTORS,
  ...SETTINGS_TOOL_DESCRIPTORS,
  ...ORCHESTRATE_TOOL_DESCRIPTORS,
  ...INSTALL_TOOL_DESCRIPTORS,
  ...LESSONS_TOOL_DESCRIPTORS,
];

export const RESOURCE_DESCRIPTORS: ResourceDescriptor[] = TOOL_DESCRIPTORS.filter(
  (d) => d.resourceUri !== undefined,
).map((d) => ({
  uri: d.resourceUri!,
  name: d.name,
  description: d.description,
  read: (ctx, params) => d.handler(ctx, params),
}));
