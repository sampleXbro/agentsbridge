import type { BuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';
import { antigravityContract } from './antigravity.js';
import { claudeCodeContract } from './claude-code.js';
import { clineContract } from './cline.js';
import { codexCliContract } from './codex-cli.js';
import { continueContract } from './continue.js';
import { copilotContract } from './copilot.js';
import { cursorContract } from './cursor.js';
import { geminiCliContract } from './gemini-cli.js';
import { junieContract } from './junie.js';
import { kiroContract } from './kiro.js';
import { rooCodeContract } from './roo-code.js';
import { windsurfContract } from './windsurf.js';
import type { TargetContractMap } from './types.js';

export type { TargetPathContract, TargetContractMap } from './types.js';

/** Same prefixes as e2e reference matrix (generated files must not leak these). */
export const TARGET_SPECIFIC_PREFIXES = [
  '.claude/',
  '.cursor/',
  '.github/',
  '.continue/',
  '.junie/',
  '.gemini/',
  '.cline/',
  '.agents/',
  '.windsurf/',
  '.roo/',
  '.kiro/',
] as const;

export const TARGET_CONTRACTS: TargetContractMap = {
  'claude-code': claudeCodeContract,
  cursor: cursorContract,
  copilot: copilotContract,
  continue: continueContract,
  junie: junieContract,
  'gemini-cli': geminiCliContract,
  cline: clineContract,
  'codex-cli': codexCliContract,
  windsurf: windsurfContract,
  antigravity: antigravityContract,
  'roo-code': rooCodeContract,
  kiro: kiroContract,
};

export function contractForTarget(id: BuiltinTargetId): TargetContractMap[BuiltinTargetId] {
  return TARGET_CONTRACTS[id];
}
