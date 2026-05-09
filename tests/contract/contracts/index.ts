import type { BuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';
import { aiderContract } from './aider.js';
import { amazonQContract } from './amazon-q.js';
import { ampContract } from './amp.js';
import { antigravityContract } from './antigravity.js';
import { augmentCodeContract } from './augment-code.js';
import { claudeCodeContract } from './claude-code.js';
import { clineContract } from './cline.js';
import { codexCliContract } from './codex-cli.js';
import { continueContract } from './continue.js';
import { copilotContract } from './copilot.js';
import { crushContract } from './crush.js';
import { cursorContract } from './cursor.js';
import { geminiCliContract } from './gemini-cli.js';
import { junieContract } from './junie.js';
import { kiloCodeContract } from './kilo-code.js';
import { kiroContract } from './kiro.js';
import { gooseContract } from './goose.js';
import { opencodeContract } from './opencode.js';
import { qwenCodeContract } from './qwen-code.js';
import { rooCodeContract } from './roo-code.js';
import { traeContract } from './trae.js';
import { windsurfContract } from './windsurf.js';
import { warpContract } from './warp.js';
import { zedContract } from './zed.js';
import type { TargetContractMap } from './types.js';

export type { TargetPathContract, TargetContractMap } from './types.js';

/** Same prefixes as e2e reference matrix (generated files must not leak these). */
export const TARGET_SPECIFIC_PREFIXES = [
  '.aider/',
  '.amazonq/',
  '.amp/',
  '.augment/',
  '.claude/',
  '.cursor/',
  '.github/',
  '.continue/',
  '.junie/',
  '.gemini/',
  '.cline/',
  '.agents/',
  '.qwen/',
  '.trae/',
  '.windsurf/',
  '.roo/',
  '.kiro/',
  '.kilo/',
  '.kilocode/',
  '.opencode/',
  '.warp/',
  '.zed/',
] as const;

export const TARGET_CONTRACTS: TargetContractMap = {
  aider: aiderContract,
  'amazon-q': amazonQContract,
  amp: ampContract,
  antigravity: antigravityContract,
  'augment-code': augmentCodeContract,
  'claude-code': claudeCodeContract,
  cline: clineContract,
  'codex-cli': codexCliContract,
  continue: continueContract,
  copilot: copilotContract,
  crush: crushContract,
  cursor: cursorContract,
  'gemini-cli': geminiCliContract,
  goose: gooseContract,
  junie: junieContract,
  'kilo-code': kiloCodeContract,
  kiro: kiroContract,
  opencode: opencodeContract,
  'qwen-code': qwenCodeContract,
  'roo-code': rooCodeContract,
  trae: traeContract,
  warp: warpContract,
  windsurf: windsurfContract,
  zed: zedContract,
};

export function contractForTarget(id: BuiltinTargetId): TargetContractMap[BuiltinTargetId] {
  return TARGET_CONTRACTS[id];
}
