import type { TargetGenerators } from '../catalog/target.interface.js';
import type { TargetDescriptor, TargetLayout } from '../catalog/target-descriptor.js';
import { projectedAgentSkillDirName } from '../projection/projected-agent-skill.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generatePermissions,
  renderAntigravityGlobalInstructions,
} from './generator.js';
import {
  ANTIGRAVITY_GLOBAL_MCP_CONFIG,
  ANTIGRAVITY_GLOBAL_ROOT,
  ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR,
  ANTIGRAVITY_HOOKS_FILE,
  ANTIGRAVITY_GLOBAL_HOOKS_FILE,
  ANTIGRAVITY_MCP_CONFIG,
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
  ANTIGRAVITY_CANONICAL_MCP,
  ANTIGRAVITY_CANONICAL_RULES_DIR,
} from './constants.js';
import { projectCapabilities, globalCapabilities } from './capabilities.js';
import { importFromAntigravity } from './importer.js';
import { nonRootRuleMapper, workflowMapper } from './import-mappers.js';
import { lintRules } from './linter.js';
import { lintPermissions } from './lint.js';
import { buildAntigravityImportPaths } from '../../core/reference/import-map-builders.js';

export const target: TargetGenerators = {
  name: 'antigravity',
  primaryRootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateHooks,
  generatePermissions,
  importFrom: importFromAntigravity,
};

const project: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_RULES_ROOT,
  skillDir: '.agents/skills',
  // managedOutputs is the sole signal `cleanupStaleGeneratedOutputs` uses to
  // decide which dirs/files to scan when reconciling post-uninstall state.
  // Antigravity emits across three dirs:
  //   - `.agents/rules`     (rules)
  //   - `.agents/workflows` (commands → workflows projection)
  //   - `.agents/skills`    (agents → skills projection + native skills)
  // Without all three here, projected outputs from an uninstalled pack would
  // linger in the user's project. The root rule file and (suppressed) MCP
  // config are listed under `files` so a flip from one root style to another
  // doesn't leave both behind.
  managedOutputs: {
    dirs: [ANTIGRAVITY_RULES_DIR, ANTIGRAVITY_WORKFLOWS_DIR, ANTIGRAVITY_SKILLS_DIR],
    files: [ANTIGRAVITY_RULES_ROOT, ANTIGRAVITY_HOOKS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ANTIGRAVITY_MCP_CONFIG) return null;
    return path;
  },
  paths: {
    rulePath(slug, _rule) {
      return `${ANTIGRAVITY_RULES_DIR}/${slug}.md`;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name) {
      return `${ANTIGRAVITY_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

const globalLayout: TargetLayout = {
  rootInstructionPath: ANTIGRAVITY_GLOBAL_ROOT,
  renderPrimaryRootInstruction: renderAntigravityGlobalInstructions,
  skillDir: ANTIGRAVITY_GLOBAL_SKILLS_DIR,
  managedOutputs: {
    dirs: [ANTIGRAVITY_GLOBAL_SKILLS_DIR, ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR],
    files: [ANTIGRAVITY_GLOBAL_ROOT, ANTIGRAVITY_GLOBAL_MCP_CONFIG, ANTIGRAVITY_GLOBAL_HOOKS_FILE],
  },
  rewriteGeneratedPath(path) {
    if (path === ANTIGRAVITY_HOOKS_FILE) return ANTIGRAVITY_GLOBAL_HOOKS_FILE;
    if (path === ANTIGRAVITY_RULES_ROOT) return ANTIGRAVITY_GLOBAL_ROOT;
    if (path.startsWith(`${ANTIGRAVITY_RULES_DIR}/`)) return null;
    if (path.startsWith('.agents/skills/')) {
      return path.replace('.agents/skills', ANTIGRAVITY_GLOBAL_SKILLS_DIR);
    }
    if (path.startsWith(`${ANTIGRAVITY_WORKFLOWS_DIR}/`)) {
      return path.replace(ANTIGRAVITY_WORKFLOWS_DIR, ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR);
    }
    if (path === ANTIGRAVITY_MCP_CONFIG) return ANTIGRAVITY_GLOBAL_MCP_CONFIG;
    return path;
  },
  paths: {
    rulePath(_slug, _rule) {
      return ANTIGRAVITY_GLOBAL_ROOT;
    },
    commandPath(name, _config) {
      return `${ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR}/${name}.md`;
    },
    agentPath(name) {
      // Return the global path directly so consumers that build a reference
      // map (e.g. `agentTargetPath` in `core/reference/map-targets.ts`) don't
      // rely on `rewriteGeneratedPath` running after them. Generation also
      // invokes the rewrite, which is now a no-op for this path.
      return `${ANTIGRAVITY_GLOBAL_SKILLS_DIR}/${projectedAgentSkillDirName(name)}/SKILL.md`;
    },
  },
};

export const descriptor = {
  id: 'antigravity',
  metadata: {
    displayName: 'Antigravity',
    category: 'ide',
    officialUrl: 'https://antigravity.google',
    shortDescription: "Google's agentic IDE",
  },
  generators: target,
  capabilities: projectCapabilities,
  emptyImportMessage:
    'No Antigravity config found (.agents/rules/, .agents/skills/, or .agents/workflows/).',
  supportsConversion: { agents: true },
  lintRules,
  lint: {
    permissions: lintPermissions,
  },
  project,
  globalSupport: {
    capabilities: globalCapabilities,
    detectionPaths: [
      '.gemini/antigravity/GEMINI.md',
      '.gemini/antigravity/skills',
      '.gemini/antigravity/workflows',
      '.gemini/antigravity/mcp_config.json',
    ],
    layout: globalLayout,
  },
  importer: {
    rules: {
      // Project-only directory scan; root rule + global-aggregated rules
      // (which collapse into the single .gemini/antigravity/GEMINI.md) are
      // handled imperatively in importer.ts.
      feature: 'rules',
      mode: 'directory',
      source: { project: [ANTIGRAVITY_RULES_DIR] },
      canonicalDir: ANTIGRAVITY_CANONICAL_RULES_DIR,
      extensions: ['.md'],
      map: nonRootRuleMapper,
    },
    commands: {
      feature: 'commands',
      mode: 'directory',
      source: {
        project: [ANTIGRAVITY_WORKFLOWS_DIR],
        global: [ANTIGRAVITY_GLOBAL_WORKFLOWS_DIR],
      },
      canonicalDir: ANTIGRAVITY_CANONICAL_COMMANDS_DIR,
      extensions: ['.md'],
      map: workflowMapper,
    },
    mcp: {
      // MCP is global-only; project-scope generation is suppressed. Source file
      // is copied verbatim (the file is already canonical-shaped JSON).
      feature: 'mcp',
      mode: 'flatFile',
      source: { global: [ANTIGRAVITY_GLOBAL_MCP_CONFIG] },
      canonicalDir: '.agentsmesh',
      canonicalFilename: ANTIGRAVITY_CANONICAL_MCP,
    },
  },
  buildImportPaths: buildAntigravityImportPaths,
  detectionPaths: [
    '.agents/rules/general.md',
    '.agents/rules/',
    '.agents/skills/',
    '.agents/workflows/',
  ],
  conversionDefaults: { agentsToSkills: true },
} satisfies TargetDescriptor;
