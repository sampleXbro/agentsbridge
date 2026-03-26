/**
 * Load canonical slice from one resolved extend (repo root + optional path).
 */

import { join } from 'node:path';
import type { CanonicalFiles } from '../core/types.js';
import type { ResolvedExtend } from '../config/resolver.js';
import { detectNativeFormat, KNOWN_NATIVE_PATHS } from '../config/native-format-detector.js';
import { exists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { loadCanonicalFiles } from './loader.js';
import { importNativeToCanonical } from './native-extends-importer.js';
import { isSkillPackLayout, loadSkillsAtExtendPath } from './skill-pack-load.js';
import { loadCanonicalSliceAtPath, normalizeSlicePath } from './load-canonical-slice.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

/**
 * Load canonical files contributed by one extend entry.
 */
export async function loadCanonicalForExtend(ext: ResolvedExtend): Promise<CanonicalFiles> {
  const base = ext.resolvedPath;

  if (!ext.path) {
    const agentsmeshDir = join(base, '.agentsmesh');
    if (!(await exists(agentsmeshDir))) {
      if (await isSkillPackLayout(base)) {
        const skills = await loadSkillsAtExtendPath(base);
        return { ...emptyCanonical(), skills };
      }
      const targetName = ext.target ?? (await detectNativeFormat(base));
      if (!targetName) {
        throw new Error(
          `Extend "${ext.name}": No supported agent configuration found in ${base}.\n` +
            `Expected one of: .agentsmesh/, ${KNOWN_NATIVE_PATHS.join(', ')}.`,
        );
      }
      logger.info(
        `[agentsmesh] Extend "${ext.name}": ${ext.target ? 'specified' : 'detected'} ${targetName} format, importing to .agentsmesh/...`,
      );
      await importNativeToCanonical(base, targetName);
    }
    return loadCanonicalFiles(base);
  }

  const rawRoot = join(base, ext.path);
  if (!(await exists(rawRoot))) {
    throw new Error(`Extend "${ext.name}": path does not exist: ${rawRoot}`);
  }

  if (ext.target) {
    const agentsmeshDir = join(base, '.agentsmesh');
    if (!(await exists(agentsmeshDir))) {
      logger.info(
        `[agentsmesh] Extend "${ext.name}": path "${ext.path}" with target "${ext.target}" — importing at extend root, then loading canonical.`,
      );
      await importNativeToCanonical(base, ext.target);
    }
    return loadCanonicalFiles(base);
  }

  const { sliceRoot } = await normalizeSlicePath(rawRoot);
  try {
    return await loadCanonicalSliceAtPath(sliceRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`Extend "${ext.name}": ${msg}`);
    if (err instanceof Error) wrapped.cause = err;
    throw wrapped;
  }
}
