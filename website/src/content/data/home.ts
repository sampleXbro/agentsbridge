/** Homepage content. Copy lives here so the MDX and components stay lean. */

export interface HomeStep {
  title: string;
  body: string;
  code: string;
}

export interface HomeLink {
  title: string;
  body: string;
  href: string;
  mono?: string;
}

export const HOME_STEPS: readonly HomeStep[] = [
  {
    title: 'Write once',
    body: 'One `.agentsmesh/` folder holds rules, commands, agents, skills, MCP servers, hooks, ignore and permissions. Existing tool configs import in one step.',
    code: 'agentsmesh init',
  },
  {
    title: 'Generate everywhere',
    body: 'Native files for every enabled tool, written where each tool expects them. Round-trip metadata keeps import lossless.',
    code: 'agentsmesh generate',
  },
  {
    title: 'Stay in sync',
    body: 'Diff, lint and check catch drift in review and CI. Watch regenerates on save.',
    code: 'agentsmesh check',
  },
];

export const HOME_SYNC: readonly HomeLink[] = [
  {
    title: 'Rules',
    mono: 'rules/',
    body: 'Root and scoped instructions.',
    href: './canonical-config/rules/',
  },
  {
    title: 'Commands',
    mono: 'commands/',
    body: 'Slash commands and prompts.',
    href: './canonical-config/commands/',
  },
  {
    title: 'Agents',
    mono: 'agents/',
    body: 'Subagent definitions.',
    href: './canonical-config/agents/',
  },
  {
    title: 'Skills',
    mono: 'skills/',
    body: 'SKILL.md plus supporting files.',
    href: './canonical-config/skills/',
  },
  {
    title: 'MCP servers',
    mono: 'mcp.json',
    body: 'One server list for every client.',
    href: './canonical-config/mcp-servers/',
  },
  {
    title: 'Hooks',
    mono: 'hooks.yaml',
    body: 'Lifecycle hooks and wrapper scripts.',
    href: './canonical-config/hooks/',
  },
  {
    title: 'Ignore',
    mono: 'ignore',
    body: 'One list, every ignore format.',
    href: './canonical-config/ignore-patterns/',
  },
  {
    title: 'Permissions',
    mono: 'permissions.yaml',
    body: 'Allow and deny lists.',
    href: './canonical-config/permissions/',
  },
];

export const HOME_LESSON_LOOP: readonly { title: string; body: string }[] = [
  {
    title: 'Recall',
    body: 'Before an edit or a risky command, the agent asks the memory what applies to this file.',
  },
  { title: 'Act', body: 'It does the work with those rules in front of it.' },
  {
    title: 'Capture',
    body: 'After a failure or a review comment, it writes one short rule with a trigger.',
  },
];

export const HOME_LESSON_LINKS: readonly { text: string; href: string }[] = [
  { text: 'Lessons guide', href: './guides/lessons/' },
  { text: 'CLI reference', href: './cli/lessons/' },
];

export const HOME_DEEPER: readonly HomeLink[] = [
  { title: 'CLI reference', body: 'Every command, flag and exit code.', href: './cli/' },
  {
    title: 'Programmatic API',
    body: 'Typed ESM entry points for scripts and CI.',
    href: './reference/programmatic-api/',
  },
  {
    title: 'Share across repos',
    body: 'Extends, packs and local overrides.',
    href: './guides/sharing-config/',
  },
  {
    title: 'Global mode',
    body: 'Sync your personal setup from `~/.agentsmesh/`.',
    href: './cli/init/',
  },
  {
    title: 'Build a plugin',
    body: 'Add a new tool as a runtime target.',
    href: './guides/building-plugins/',
  },
  {
    title: 'Compare',
    body: 'AgentsMesh vs Ruler and rulesync.',
    href: './reference/alternatives/',
  },
];

/** Output paths drawn on the hero mesh. Decorative; the matrix page is the source of truth. */
export const HOME_MESH_TARGETS: readonly string[] = [
  'CLAUDE.md',
  '.cursor/rules/',
  '.github/copilot-instructions.md',
  '.gemini/settings.json',
  '.codex/config.toml',
  '.windsurf/rules/',
  'AGENTS.md',
  'and every other tool',
];
