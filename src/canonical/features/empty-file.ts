import { logger } from '../../utils/output/logger.js';

/** Skip a blank canonical file, but say so: silence reads as "no such rule". */
export function isEmptyCanonicalFile(content: string, path: string): boolean {
  if (content.trim() !== '') return false;
  logger.warn(`Skipping empty canonical file ${path.replaceAll('\\', '/')}`);
  return true;
}
