import type { CanonicalFiles, GenerateResult } from '../types.js';
import { appendAgentsmeshRootInstructionParagraph } from '../../targets/projection/root-instruction-paragraph.js';
import type { TargetLayout, TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { getTargetLayout } from '../../targets/catalog/builtin-targets.js';
import { getAdditionalRootDecorationPaths } from '../../targets/catalog/layout-outputs.js';

function rootDecorationPaths(layout: TargetLayout | undefined): readonly string[] {
  if (!layout?.rootInstructionPath) return [];
  return [layout.rootInstructionPath, ...getAdditionalRootDecorationPaths(layout)];
}

export function decoratePrimaryRootInstructions(
  results: GenerateResult[],
  canonical: CanonicalFiles,
  scope: TargetLayoutScope = 'project',
): GenerateResult[] {
  return results.map((result) => {
    const layout = getTargetLayout(result.target, scope);
    if (!layout) return result;
    const paths = rootDecorationPaths(layout);
    if (paths.length === 0 || !paths.includes(result.path)) {
      return result;
    }

    const isPrimary = result.path === layout.rootInstructionPath;
    const baseContent =
      isPrimary && layout.renderPrimaryRootInstruction
        ? layout.renderPrimaryRootInstruction(canonical)
        : result.content;
    const finalContent = appendAgentsmeshRootInstructionParagraph(baseContent);
    if (finalContent === result.content) return result;
    return { ...result, content: finalContent };
  });
}
