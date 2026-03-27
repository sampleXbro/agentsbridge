/**
 * Interactive collision checks against merged canonical before writing an extend.
 */

import type {
  CanonicalAgent,
  CanonicalCommand,
  CanonicalFiles,
  CanonicalRule,
  CanonicalSkill,
} from '../../core/types.js';
import { confirm } from './prompts.js';
import { ruleSlug } from './validate-resources.js';

export async function resolveInstallConflicts(
  merged: CanonicalFiles,
  pools: {
    skills: CanonicalSkill[];
    rules: CanonicalRule[];
    commands: CanonicalCommand[];
    agents: CanonicalAgent[];
  },
): Promise<{
  skillNames: string[];
  ruleSlugs: string[];
  commandNames: string[];
  agentNames: string[];
}> {
  let skillsSel = pools.skills.map((s) => s.name);
  let rulesSel = pools.rules.map((r) => ruleSlug(r));
  let commandsSel = pools.commands.map((c) => c.name);
  let agentsSel = pools.agents.map((a) => a.name);

  for (const s of pools.skills) {
    if (merged.skills.some((x) => x.name === s.name)) {
      const ok = await confirm(
        `Skill "${s.name}" already exists in merged config. Add extend anyway?`,
      );
      if (!ok) skillsSel = skillsSel.filter((n) => n !== s.name);
    }
  }
  for (const r of pools.rules) {
    const slug = ruleSlug(r);
    if (merged.rules.some((x) => ruleSlug(x) === slug)) {
      const ok = await confirm(
        `Rule "${slug}" already exists in merged config. Add extend anyway?`,
      );
      if (!ok) rulesSel = rulesSel.filter((n) => n !== slug);
    }
  }
  for (const c of pools.commands) {
    if (merged.commands.some((x) => x.name === c.name)) {
      const ok = await confirm(
        `Command "${c.name}" already exists in merged config. Add extend anyway?`,
      );
      if (!ok) commandsSel = commandsSel.filter((n) => n !== c.name);
    }
  }
  for (const a of pools.agents) {
    if (merged.agents.some((x) => x.name === a.name)) {
      const ok = await confirm(
        `Agent "${a.name}" already exists in merged config. Add extend anyway?`,
      );
      if (!ok) agentsSel = agentsSel.filter((n) => n !== a.name);
    }
  }

  return {
    skillNames: skillsSel,
    ruleSlugs: rulesSel,
    commandNames: commandsSel,
    agentNames: agentsSel,
  };
}
