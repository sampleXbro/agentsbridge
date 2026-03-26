/**
 * Resolve local or fetched path for agentsmesh install.
 */

import { fetchInstallSource } from './fetch-install-source.js';
import type { ParsedInstallSource } from './url-parser.js';

export async function resolveInstallResolvedPath(
  parsed: ParsedInstallSource,
  sourceArg: string,
): Promise<{ resolvedPath: string; sourceForYaml: string; version?: string }> {
  if (parsed.kind === 'local') {
    return {
      resolvedPath: parsed.localRoot!,
      sourceForYaml: parsed.localSourceForYaml!,
    };
  }
  try {
    const fetched = await fetchInstallSource(parsed);
    return {
      resolvedPath: fetched.resolvedPath,
      sourceForYaml: fetched.sourceForYaml,
      version: fetched.version,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(
      `Failed to fetch from ${sourceArg}: ${msg}. Check your network connection and try again.`,
    );
    if (e instanceof Error) err.cause = e;
    throw err;
  }
}
