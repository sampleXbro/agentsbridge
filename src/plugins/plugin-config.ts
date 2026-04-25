/**
 * Read/write plugin entries in agentsmesh.yaml.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join } from 'node:path';
import { readFileSafe, writeFileAtomic } from '../utils/filesystem/fs.js';
import type { PluginEntry } from '../config/core/schema.js';

const CONFIG_FILENAME = 'agentsmesh.yaml';

export interface RawPluginConfig {
  plugins?: Array<{ id: string; source: string; version?: string }>;
  pluginTargets?: string[];
  [key: string]: unknown;
}

/**
 * Read raw agentsmesh.yaml as a plain object (no Zod validation).
 * Returns empty object if file doesn't exist.
 */
export async function readScopedConfigRaw(projectRoot: string): Promise<RawPluginConfig> {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const content = await readFileSafe(configPath);
  if (content === null) return {};
  const raw = parseYaml(content) as unknown;
  return (raw as RawPluginConfig) ?? {};
}

/**
 * Add a plugin entry to agentsmesh.yaml.
 * Dedupes by id — does nothing if an entry with the same id already exists.
 * Creates agentsmesh.yaml if it doesn't exist.
 */
export async function writePluginEntry(projectRoot: string, entry: PluginEntry): Promise<void> {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const content = (await readFileSafe(configPath)) ?? 'version: 1\n';
  const raw = (parseYaml(content) as RawPluginConfig) ?? {};

  if (!raw.plugins) raw.plugins = [];

  // Dedupe by id
  if (raw.plugins.some((p) => p.id === entry.id)) return;

  const toAdd: { id: string; source: string; version?: string } = {
    id: entry.id,
    source: entry.source,
  };
  if (entry.version !== undefined) toAdd.version = entry.version;

  raw.plugins.push(toAdd);
  await writeFileAtomic(configPath, stringifyYaml(raw));
}

/**
 * Remove a plugin entry by id from agentsmesh.yaml.
 * Also removes the id from pluginTargets if present.
 * @returns true if an entry was removed
 */
export async function removePluginEntry(projectRoot: string, id: string): Promise<boolean> {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  const content = await readFileSafe(configPath);
  if (content === null) return false;

  const raw = (parseYaml(content) as RawPluginConfig) ?? {};
  const before = (raw.plugins ?? []).length;

  raw.plugins = (raw.plugins ?? []).filter((p) => p.id !== id);
  if (raw.pluginTargets) {
    raw.pluginTargets = raw.pluginTargets.filter((t) => t !== id);
  }

  const removed = raw.plugins.length < before;
  if (removed) {
    await writeFileAtomic(configPath, stringifyYaml(raw));
  }
  return removed;
}
