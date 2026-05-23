/**
 * Scan a pack's root for a preserved-boilerplate license file and return the
 * detected SPDX identifier. Returns `null` when no candidate file is present
 * or when the text fingerprint matches nothing in `detectSpdxLicense`.
 *
 * Probed in priority order: LICENSE, COPYING, NOTICE, COPYRIGHT — each with
 * common extensions (no extension, `.md`, `.txt`, `.rst`). Stops at the first
 * file that yields a non-null detection so a NOTICE that names the upstream's
 * license (e.g. Apache-2.0 NOTICE companion) doesn't override the actual
 * LICENSE next to it.
 */

import { join } from 'node:path';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { detectSpdxLicense } from './detect-license.js';

const LICENSE_BASENAMES: readonly string[] = ['LICENSE', 'COPYING', 'NOTICE', 'COPYRIGHT'];
const LICENSE_EXTENSIONS: readonly string[] = ['', '.md', '.txt', '.rst'];

export async function detectLicenseInPackDir(packDir: string): Promise<string | null> {
  for (const base of LICENSE_BASENAMES) {
    for (const ext of LICENSE_EXTENSIONS) {
      const content = await readFileSafe(join(packDir, `${base}${ext}`));
      if (content === null) continue;
      const detected = detectSpdxLicense(content);
      if (detected !== null) return detected;
    }
  }
  return null;
}
