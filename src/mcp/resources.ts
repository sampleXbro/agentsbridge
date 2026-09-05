import type { McpContext } from './context.js';
import { McpError, redactAbsolutePaths } from './errors.js';
import { matchResourceTemplate } from './resource-template.js';
import type { ResourceDescriptor } from './tool-tables/types.js';

interface Resolved {
  descriptor: ResourceDescriptor;
  params: Record<string, string>;
}

/** Literal characters in a template; more literals = more specific. */
function specificity(template: string): number {
  return template.replace(/\{[^}]+\}/g, '').length;
}

/** A trailing placeholder spans slashes, so overlapping templates are ranked by specificity. */
function resolveResource(descriptors: readonly ResourceDescriptor[], uri: string): Resolved {
  let best: Resolved | null = null;
  for (const descriptor of descriptors) {
    const params = matchResourceTemplate(descriptor.uri, uri);
    if (params === null) continue;
    if (best === null || specificity(descriptor.uri) > specificity(best.descriptor.uri)) {
      best = { descriptor, params };
    }
  }
  if (best === null) throw new McpError('NOT_FOUND', `resource not found: ${uri}`);
  return best;
}

/** Convert any failure into an McpError whose message never leaks host paths. */
export function toMcpError(e: unknown): McpError {
  if (e instanceof McpError) return e;
  const message = e instanceof Error ? e.message : 'unknown error';
  return new McpError('IO_ERROR', redactAbsolutePaths(message));
}

/**
 * Read a resource the same way a tool call runs: params validated against the
 * descriptor's input schema, errors normalized and redacted.
 */
export async function readResource(
  descriptors: readonly ResourceDescriptor[],
  uri: string,
  ctx: McpContext | (() => Promise<McpContext>),
): Promise<unknown> {
  const { descriptor, params } = resolveResource(descriptors, uri);
  const parsed = descriptor.inputSchema.safeParse(params);
  if (!parsed.success) {
    throw new McpError('VALIDATION_FAILED', `invalid resource params: ${parsed.error.message}`);
  }
  try {
    const context = typeof ctx === 'function' ? await ctx() : ctx;
    return await descriptor.read(context, params);
  } catch (e) {
    throw toMcpError(e);
  }
}
