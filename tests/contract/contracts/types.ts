import type { BuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';

export interface TargetPathContract {
  readonly generated: readonly string[];
  readonly imported: readonly string[];
}

export type TargetContractMap = Record<BuiltinTargetId, TargetPathContract>;
