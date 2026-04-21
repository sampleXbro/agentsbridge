import { normalizeSeparators } from '../path-helpers.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { resolveProjectPath } from './link-rebaser-helpers.js';
import { isUnderAgentsMesh } from './link-rebaser-output.js';

export interface ShouldSkipGlobalNonMeshLinkInput {
  scope?: TargetLayoutScope;
  projectRoot: string;
  sourceFile: string;
  candidate: string;
}

export function shouldSkipGlobalNonMeshLink(input: ShouldSkipGlobalNonMeshLinkInput): boolean {
  if (input.scope !== 'global') return false;

  const normalizedCandidate = normalizeSeparators(input.candidate).replace(/^\.\//, '');
  const explicitlyReferencesMesh =
    normalizedCandidate.startsWith('.agentsmesh/') ||
    normalizedCandidate.startsWith('agentsmesh/') ||
    normalizedCandidate.includes('/.agentsmesh/');
  if (explicitlyReferencesMesh) return false;

  const resolvedCandidates = resolveProjectPath(
    input.candidate,
    input.projectRoot,
    input.sourceFile,
  );
  if (resolvedCandidates.length === 0) return false;

  return resolvedCandidates.every(
    (resolvedCandidate) => !isUnderAgentsMesh(input.projectRoot, resolvedCandidate),
  );
}
