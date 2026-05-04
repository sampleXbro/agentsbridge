import type { BuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';
import { ampContract } from './amp.js';
import { antigravityContract } from './antigravity.js';
import { claudeCodeContract } from './claude-code.js';
import { clineContract } from './cline.js';
import { codexCliContract } from './codex-cli.js';
import { continueContract } from './continue.js';
import { copilotContract } from './copilot.js';
import { cursorContract } from './cursor.js';
import { geminiCliContract } from './gemini-cli.js';
import { junieContract } from './junie.js';
import { kiloCodeContract } from './kilo-code.js';
import { kiroContract } from './kiro.js';
import { gooseContract } from './goose.js';
import { opencodeContract } from './opencode.js';
import { rooCodeContract } from './roo-code.js';
import { windsurfContract } from './windsurf.js';
import { zedContract } from './zed.js';
import type { TargetContractMap } from './types.js';

export type { TargetPathContract, TargetContractMap } from './types.js';

/** Same prefixes as e2e reference matrix (generated files must not leak these). */
export const TARGET_SPECIFIC_PREFIXES = [
  '.amp/',
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
  '.kilo/',
  '.kilocode/',
  '.opencode/',
  '.zed/',
] as const;

export const TARGET_CONTRACTS: TargetContractMap = {
  amp: ampContract,
  'claude-code': claudeCodeContract,
  cursor: cursorContract,
  copilot: copilotContract,
  continue: continueContract,
  goose: gooseContract,
  junie: junieContract,
  'gemini-cli': geminiCliContract,
  cline: clineContract,
  'codex-cli': codexCliContract,
  windsurf: windsurfContract,
  antigravity: antigravityContract,
  'roo-code': rooCodeContract,
  kiro: kiroContract,
  'kilo-code': kiloCodeContract,
  opencode: opencodeContract,
  zed: zedContract,
};

export function contractForTarget(id: BuiltinTargetId): TargetContractMap[BuiltinTargetId] {
  return TARGET_CONTRACTS[id];
}
