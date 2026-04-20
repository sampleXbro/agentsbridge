import type { CanonicalFiles } from '../../../core/types.js';
import { GEMINI_IGNORE } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateIgnore(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.ignore || canonical.ignore.length === 0) return [];
  return [{ path: GEMINI_IGNORE, content: canonical.ignore.join('\n') }];
}
