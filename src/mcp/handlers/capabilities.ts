import { McpError } from '../errors.js';
import { getTargetCapabilities } from '../../targets/catalog/builtin-targets.js';
import { getAllRegisteredDescriptorIds } from '../../targets/catalog/registry.js';

type TargetCapabilityMap = Record<string, unknown>;
type TargetCapabilitiesRecord = Record<string, TargetCapabilityMap>;

/**
 * Built per call, not at import time: plugin descriptors register after the
 * server starts, and the MCP surface must see them like any builtin target.
 */
function buildTargetIndex(): TargetCapabilitiesRecord {
  return Object.fromEntries(
    getAllRegisteredDescriptorIds().flatMap((targetId) => {
      const caps = getTargetCapabilities(targetId, 'project');
      return caps === undefined ? [] : [[targetId, caps]];
    }),
  );
}

export interface TargetCapabilitiesEntry {
  targetId: string;
  capabilities: TargetCapabilityMap;
}

export const capabilitiesHandlers = {
  async list(): Promise<TargetCapabilitiesRecord> {
    return buildTargetIndex();
  },
  async get(input: { targetId: string }): Promise<TargetCapabilitiesEntry> {
    const entry = buildTargetIndex()[input.targetId];
    if (entry === undefined) {
      throw new McpError('NOT_FOUND', `unknown target: ${input.targetId}`);
    }
    return { targetId: input.targetId, capabilities: entry };
  },
};
