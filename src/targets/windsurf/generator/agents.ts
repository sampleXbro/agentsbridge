import type { CanonicalFiles } from '../../../core/types.js';
import {
  projectedAgentSkillDirName,
  serializeProjectedAgentSkill,
} from '../../projection/projected-agent-skill.js';
import { WINDSURF_SKILLS_DIR } from '../constants.js';
import type { RulesOutput } from './types.js';

export function generateAgents(canonical: CanonicalFiles): RulesOutput[] {
  return canonical.agents.map((agent) => ({
    path: `${WINDSURF_SKILLS_DIR}/${projectedAgentSkillDirName(agent.name)}/SKILL.md`,
    content: serializeProjectedAgentSkill(agent),
  }));
}
