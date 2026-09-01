import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface ScaffoldOptions {
  readonly resource: string;
  readonly root: string;
}

function routeSource(resource: string): string {
  return [
    `import { Router } from 'express';`,
    `import { ${resource}Schema } from '../schemas/${resource}.js';`,
    ``,
    `export const ${resource}Router = Router();`,
    ``,
    `${resource}Router.get('/v1/${resource}', async (req, res) => {`,
    `  const query = ${resource}Schema.list.parse(req.query);`,
    `  res.json(await req.repos.${resource}.list(query));`,
    `});`,
    ``,
  ].join('\n');
}

export async function scaffoldRoute(options: ScaffoldOptions): Promise<string> {
  const target = join(options.root, 'src', 'server', `${options.resource}.ts`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, routeSource(options.resource), 'utf-8');
  return target;
}
