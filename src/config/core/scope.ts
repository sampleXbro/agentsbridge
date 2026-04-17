import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfigFromDir, loadConfigFromExactDir } from './loader.js';
import type { ValidatedConfig } from './schema.js';

export type ConfigScope = 'project' | 'global';

export interface ScopeContext {
  scope: ConfigScope;
  rootBase: string;
  configDir: string;
  canonicalDir: string;
}

export interface ScopedConfigResult {
  config: ValidatedConfig;
  context: ScopeContext;
}

export function resolveScopeContext(
  startDir: string,
  scope: ConfigScope = 'project',
): ScopeContext {
  if (scope === 'project') {
    return {
      scope,
      rootBase: startDir,
      configDir: startDir,
      canonicalDir: join(startDir, '.agentsmesh'),
    };
  }

  const rootBase = homedir();
  const configDir = join(rootBase, '.agentsmesh');
  return {
    scope,
    rootBase,
    configDir,
    canonicalDir: configDir,
  };
}

export async function loadScopedConfig(
  startDir: string,
  scope: ConfigScope = 'project',
): Promise<ScopedConfigResult> {
  if (scope === 'project') {
    const { config, configDir } = await loadConfigFromDir(startDir);
    return {
      config,
      context: {
        scope,
        rootBase: configDir,
        configDir,
        canonicalDir: join(configDir, '.agentsmesh'),
      },
    };
  }

  const context = resolveScopeContext(startDir, scope);
  const { config } = await loadConfigFromExactDir(context.configDir);
  return { config, context };
}
