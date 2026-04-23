import type { CanonicalFiles } from '../../../core/types.js';
import { CURSOR_IGNORE } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  const content = canonical.ignore.join('\n');
  return [{ path: CURSOR_IGNORE, content }];
}
