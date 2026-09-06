/**
 * Tool logos for the hero hub, resolved at build time from simple-icons (MIT).
 * Each entry renders as a 24×24 path; a stroked fallback covers a tool whose
 * logo that set does not carry.
 */
import { siClaude, siCursor, siGithubcopilot, siGooglegemini, siWindsurf } from 'simple-icons';

/** @typedef {{ path: string, stroke?: true }} ToolIcon */

/** @type {Record<string, ToolIcon>} */
export const TOOL_ICONS = {
  claude: { path: siClaude.path },
  cursor: { path: siCursor.path },
  copilot: { path: siGithubcopilot.path },
  gemini: { path: siGooglegemini.path },
  windsurf: { path: siWindsurf.path },
  // A terminal window with a prompt: simple-icons no longer ships the OpenAI mark.
  codex: { path: 'M3.5 5.5h17v13h-17z M7.5 9.5l3 2.5-3 2.5 M12.5 14.5h4', stroke: true },
};
