import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DESCRIPTORS, RESOURCE_DESCRIPTORS, zodToMcpSchema } from './register.js';
import { resolveContext } from './context.js';
import { McpError, redactAbsolutePaths } from './errors.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

async function pkgVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    resolve(here, '../../package.json'),
    resolve(here, '../package.json'),
    resolve(here, '../../../package.json'),
  ]) {
    try {
      const pkg = JSON.parse(await readFile(candidate, 'utf8')) as {
        version: string;
        name: string;
      };
      if (pkg.name === 'agentsmesh') return pkg.version;
    } catch {
      /* try next */
    }
  }
  return '0.0.0';
}

function matchTemplate(template: string, actual: string): boolean {
  const re = new RegExp('^' + template.replace(/\{[^}]+\}/g, '([^/]+)') + '$');
  return re.test(actual);
}

function extractTemplateParams(template: string, actual: string): Record<string, string> {
  const keys = [...template.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  const re = new RegExp('^' + template.replace(/\{[^}]+\}/g, '([^/]+)') + '$');
  const m = re.exec(actual);
  if (!m) return {};
  return Object.fromEntries(keys.map((k, i) => [k, m[i + 1]!]));
}

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: 'agentsmesh-mcp', version: await pkgVersion() },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DESCRIPTORS.map((d) => ({
      name: d.name,
      description: d.description,
      inputSchema: zodToMcpSchema(d.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const desc = TOOL_DESCRIPTORS.find((d) => d.name === req.params.name);
    if (!desc) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              code: 'NOT_FOUND',
              message: `unknown tool: ${req.params.name}`,
            }),
          },
        ],
      };
    }
    try {
      const parsed = desc.inputSchema.safeParse(req.params.arguments ?? {});
      if (!parsed.success) {
        throw new McpError('VALIDATION_FAILED', 'invalid input', parsed.error.issues);
      }
      const ctx = await resolveContext({ cwd: process.cwd() });
      const result = await desc.handler(ctx, parsed.data);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (e) {
      const env =
        e instanceof McpError
          ? e.toEnvelope()
          : {
              code: 'IO_ERROR' as const,
              message: redactAbsolutePaths(e instanceof Error ? e.message : 'unknown error'),
            };
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify(env) }],
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCE_DESCRIPTORS.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const desc = RESOURCE_DESCRIPTORS.find(
      (r) => r.uri === req.params.uri || matchTemplate(r.uri, req.params.uri),
    );
    if (!desc) throw new McpError('NOT_FOUND', `resource not found: ${req.params.uri}`);
    const ctx = await resolveContext({ cwd: process.cwd() });
    const params = extractTemplateParams(desc.uri, req.params.uri);
    const data = await desc.read(ctx, params);
    return {
      contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify(data) }],
    };
  });

  await server.connect(new StdioServerTransport());
}
