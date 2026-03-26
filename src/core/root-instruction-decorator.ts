import type { GenerateResult } from './types.js';
import { getTarget } from '../targets/registry.js';
import { appendAgentsmeshRootInstructionParagraph } from '../targets/root-instruction-paragraph.js';

export function decoratePrimaryRootInstructions(results: GenerateResult[]): GenerateResult[] {
  return results.map((result) => {
    let primaryRootInstructionPath: string | undefined;
    try {
      primaryRootInstructionPath = getTarget(result.target).primaryRootInstructionPath;
    } catch {
      return result;
    }

    if (!primaryRootInstructionPath || result.path !== primaryRootInstructionPath) {
      return result;
    }

    const content = appendAgentsmeshRootInstructionParagraph(result.content);
    return content === result.content ? result : { ...result, content };
  });
}
