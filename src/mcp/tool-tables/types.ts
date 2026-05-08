import type { z } from 'zod';
import type { McpContext } from '../context.js';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: McpContext, input: unknown) => Promise<unknown>;
  resourceUri?: string;
}

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  read: (ctx: McpContext, params: Record<string, string>) => Promise<unknown>;
}
