/**
 * Generates JSON Schema files into schemas/ from Zod source schemas.
 * Run: pnpm schemas:generate
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildAllSchemas } from '../src/schemas/schema-generator.js';

const OUT_DIR = join(process.cwd(), 'schemas');
mkdirSync(OUT_DIR, { recursive: true });

const schemas = buildAllSchemas();
const files: Record<string, string> = {
  'agentsmesh.json': 'agentsmesh',
  'permissions.json': 'permissions',
  'hooks.json': 'hooks',
  'mcp.json': 'mcp',
  'pack.json': 'pack',
};

for (const [filename, key] of Object.entries(files)) {
  const schema = schemas[key as keyof typeof schemas];
  const outPath = join(OUT_DIR, filename);
  writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n');
  console.log(`✓ schemas/${filename}`);
}

console.log('\nDone. Commit schemas/ to keep them in sync.');
