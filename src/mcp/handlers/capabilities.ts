import { McpError } from '../errors.js';
import { SUPPORT_MATRIX } from '../../core/matrix/data.js';
import { TARGET_IDS } from '../../targets/catalog/target-ids.js';

type TargetCapabilityMap = Record<string, unknown>;
type TargetCapabilitiesRecord = Record<string, TargetCapabilityMap>;

function buildTargetIndex(): TargetCapabilitiesRecord {
  return Object.fromEntries(
    TARGET_IDS.map((targetId) => [
      targetId,
      Object.fromEntries(
        Object.entries(SUPPORT_MATRIX).map(([feature, targets]) => [
          feature,
          (targets as Record<string, unknown>)[targetId],
        ]),
      ),
    ]),
  );
}

const TARGET_INDEX: TargetCapabilitiesRecord = buildTargetIndex();

export interface TargetCapabilitiesEntry {
  targetId: string;
  capabilities: TargetCapabilityMap;
}

export const capabilitiesHandlers = {
  async list(): Promise<TargetCapabilitiesRecord> {
    return TARGET_INDEX;
  },
  async get(input: { targetId: string }): Promise<TargetCapabilitiesEntry> {
    const entry = TARGET_INDEX[input.targetId];
    if (entry === undefined) {
      throw new McpError('NOT_FOUND', `unknown target: ${input.targetId}`);
    }
    return { targetId: input.targetId, capabilities: entry };
  },
};
