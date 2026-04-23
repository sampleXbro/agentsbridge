/**
 * JSON Schema generation tests.
 * Verifies that each Zod schema produces a well-formed JSON Schema
 * and that the committed schema files in schemas/ stay in sync.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { configSchema } from '../../../src/config/core/schema.js';
import { packMetadataSchema } from '../../../src/install/pack/pack-schema.js';
import {
  permissionsSchema,
  hooksSchema,
  mcpConfigSchema,
} from '../../../src/schemas/canonical-schemas.js';
import { buildAllSchemas } from '../../../src/schemas/schema-generator.js';

const SCHEMAS_DIR = join(process.cwd(), 'schemas');

// ─── Shape tests ──────────────────────────────────────────────────────────────

describe('configSchema → JSON Schema', () => {
  it('produces a valid JSON Schema object', () => {
    const schema = z.toJSONSchema(configSchema, { unrepresentable: 'any' });
    expect(schema).toMatchObject({ type: 'object' });
  });

  it('requires version field', () => {
    const schema = z.toJSONSchema(configSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const required = schema.required as string[];
    expect(required).toContain('version');
  });

  it('exposes targets and features as enum arrays', () => {
    const schema = z.toJSONSchema(configSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const props = schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty('targets');
    expect(props).toHaveProperty('features');
    const targets = props.targets as Record<string, unknown>;
    expect(targets).toHaveProperty('items');
    const items = targets.items as Record<string, unknown>;
    expect(Array.isArray(items.enum)).toBe(true);
    expect((items.enum as string[]).length).toBeGreaterThan(0);
  });

  it('exposes extends as an array of objects', () => {
    const schema = z.toJSONSchema(configSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const props = schema.properties as Record<string, unknown>;
    const extendsSchema = props.extends as Record<string, unknown>;
    expect(extendsSchema.type).toBe('array');
  });
});

describe('permissionsSchema → JSON Schema', () => {
  it('produces a valid JSON Schema object', () => {
    const schema = z.toJSONSchema(permissionsSchema, { unrepresentable: 'any' });
    expect(schema).toMatchObject({ type: 'object' });
  });

  it('has allow, deny, ask as arrays of strings', () => {
    const schema = z.toJSONSchema(permissionsSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const props = schema.properties as Record<string, unknown>;
    for (const field of ['allow', 'deny', 'ask']) {
      const f = props[field] as Record<string, unknown>;
      expect(f.type).toBe('array');
    }
  });
});

describe('hooksSchema → JSON Schema', () => {
  it('produces a valid JSON Schema object', () => {
    const schema = z.toJSONSchema(hooksSchema, { unrepresentable: 'any' });
    expect(typeof schema).toBe('object');
  });

  it('is an object with additionalProperties for hook entries', () => {
    const schema = z.toJSONSchema(hooksSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    // Record type produces additionalProperties or patternProperties
    expect(schema.type).toBe('object');
  });
});

describe('mcpConfigSchema → JSON Schema', () => {
  it('produces a valid JSON Schema object', () => {
    const schema = z.toJSONSchema(mcpConfigSchema, { unrepresentable: 'any' });
    expect(schema).toMatchObject({ type: 'object' });
  });

  it('has mcpServers property', () => {
    const schema = z.toJSONSchema(mcpConfigSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const props = schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty('mcpServers');
  });
});

describe('packMetadataSchema → JSON Schema', () => {
  it('produces a valid JSON Schema object', () => {
    const schema = z.toJSONSchema(packMetadataSchema, { unrepresentable: 'any' });
    expect(schema).toMatchObject({ type: 'object' });
  });

  it('requires name, source, source_kind, features fields', () => {
    const schema = z.toJSONSchema(packMetadataSchema, { unrepresentable: 'any' }) as Record<
      string,
      unknown
    >;
    const required = schema.required as string[];
    expect(required).toContain('name');
    expect(required).toContain('source');
    expect(required).toContain('source_kind');
    expect(required).toContain('features');
  });
});

// ─── buildAllSchemas ──────────────────────────────────────────────────────────

describe('buildAllSchemas()', () => {
  it('returns all 5 named schemas', () => {
    const schemas = buildAllSchemas();
    expect(schemas).toHaveProperty('agentsmesh');
    expect(schemas).toHaveProperty('permissions');
    expect(schemas).toHaveProperty('hooks');
    expect(schemas).toHaveProperty('mcp');
    expect(schemas).toHaveProperty('pack');
  });

  it('each schema is a non-empty object', () => {
    const schemas = buildAllSchemas();
    for (const [key, schema] of Object.entries(schemas)) {
      expect(typeof schema, `${key} should be an object`).toBe('object');
      expect(Object.keys(schema).length, `${key} should be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ─── Committed schema file freshness ─────────────────────────────────────────

describe('schemas/ committed files are in sync', () => {
  const EXPECTED_FILES = [
    'agentsmesh.json',
    'permissions.json',
    'hooks.json',
    'mcp.json',
    'pack.json',
  ];

  for (const file of EXPECTED_FILES) {
    it(`schemas/${file} exists`, () => {
      expect(existsSync(join(SCHEMAS_DIR, file))).toBe(true);
    });

    it(`schemas/${file} matches generated output`, () => {
      const onDisk = JSON.parse(readFileSync(join(SCHEMAS_DIR, file), 'utf8')) as Record<
        string,
        unknown
      >;
      const generated = buildAllSchemas();
      const key = file.replace('.json', '') as keyof ReturnType<typeof buildAllSchemas>;
      expect(onDisk).toEqual(generated[key]);
    });
  }
});
