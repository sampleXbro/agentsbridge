/**
 * Find and load agentsmesh config file.
 */

import { parse as parseYaml } from 'yaml';
import { join, dirname, resolve } from 'node:path';
import { readFileSafe, exists } from '../../utils/filesystem/fs.js';
import { logger } from '../../utils/output/logger.js';
import { configSchema, type ValidatedConfig } from './schema.js';

const CONFIG_FILENAME = 'agentsmesh.yaml';
const LOCAL_CONFIG_FILENAME = 'agentsmesh.local.yaml';

/**
 * Search upward from startDir for agentsmesh.yaml.
 * @param startDir - Directory to start searching from
 * @returns Absolute path to config file, or null if not found
 */
export async function findConfigPath(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);

  while (true) {
    const configPath = join(dir, CONFIG_FILENAME);
    if (await exists(configPath)) {
      return configPath;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Load and validate config from a YAML file.
 * @param configPath - Absolute path to agentsmesh.yaml
 * @returns Validated config
 * @throws Error if file not found or validation fails
 */
export async function loadConfig(configPath: string): Promise<ValidatedConfig> {
  const content = await readFileSafe(configPath);
  if (content === null) {
    throw new Error(
      `Config file not found: ${configPath}. Create agentsmesh.yaml in project root.`,
    );
  }

  const raw = parseYaml(content) as unknown;
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid config at ${configPath}: ${issues}. Fix the YAML and try again.`, {
      cause: result.error,
    });
  }
  return result.data;
}

function deepMergeObjects(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined) continue;
    const baseVal = result[k];
    if (
      typeof v === 'object' &&
      !Array.isArray(v) &&
      v !== null &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[k] = deepMergeObjects(
        baseVal as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      result[k] = v;
    }
  }
  return result;
}

/** Per PRD 3.2: targets/features replace; overrides deep merge; extends append. */
function mergeLocalConfig(
  project: ValidatedConfig,
  local: Record<string, unknown>,
): ValidatedConfig {
  const merged = { ...project } as Record<string, unknown>;

  if (Array.isArray(local.targets) && local.targets.length > 0) {
    merged.targets = local.targets;
  }
  if (Array.isArray(local.features) && local.features.length > 0) {
    merged.features = local.features;
  }
  if (
    typeof local.overrides === 'object' &&
    local.overrides !== null &&
    !Array.isArray(local.overrides)
  ) {
    merged.overrides = deepMergeObjects(
      (merged.overrides ?? {}) as Record<string, unknown>,
      local.overrides as Record<string, unknown>,
    );
  }
  if (
    typeof local.conversions === 'object' &&
    local.conversions !== null &&
    !Array.isArray(local.conversions)
  ) {
    merged.conversions = deepMergeObjects(
      (merged.conversions ?? {}) as Record<string, unknown>,
      local.conversions as Record<string, unknown>,
    );
  }
  if (Array.isArray(local.extends) && local.extends.length > 0) {
    merged.extends = [...(project.extends ?? []), ...local.extends];
  }

  return merged as ValidatedConfig;
}

/**
 * Find config from dir, load it, merge agentsmesh.local.yaml if present.
 * Merge strategy (PRD 3.2): targets/features replace; overrides deep merge; extends append.
 * @param startDir - Directory to start searching from
 * @returns Config and directory containing agentsmesh.yaml
 * @throws Error if no config found
 */
export async function loadConfigFromDir(
  startDir: string,
): Promise<{ config: ValidatedConfig; configDir: string }> {
  const configPath = await findConfigPath(startDir);
  if (configPath === null) {
    throw new Error(
      `No agentsmesh.yaml found from ${startDir}. Run 'agentsmesh init' to create one.`,
    );
  }

  const configDir = dirname(configPath);
  let config = await loadConfig(configPath);

  const localPath = join(configDir, LOCAL_CONFIG_FILENAME);
  const localContent = await readFileSafe(localPath);
  if (localContent !== null) {
    const localRaw = parseYaml(localContent) as unknown;
    if (typeof localRaw === 'object' && localRaw !== null && !Array.isArray(localRaw)) {
      const merged = mergeLocalConfig(config, localRaw as Record<string, unknown>);
      const parsed = configSchema.safeParse(merged);
      if (parsed.success) {
        config = parsed.data;
      } else {
        const issues = parsed.error.issues.map((i) => i.message).join('; ');
        logger.warn(
          `Ignoring invalid agentsmesh.local.yaml at ${localPath}: ${issues}. Using project config instead.`,
        );
      }
    }
  }

  return { config, configDir };
}
