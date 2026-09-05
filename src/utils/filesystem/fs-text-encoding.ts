/**
 * Text-encoding helpers for atomic writes: line-ending normalization,
 * UTF-8 BOM constant, and executable-mode inference for shell scripts.
 *
 * Separated from `fs.ts` to keep that module under the project's
 * 200-line file budget (CLAUDE.md).
 */
import { basename, extname } from 'node:path';

export const UTF8_BOM = '﻿';

/**
 * Text-like extensions whose payload must use LF line endings on disk so
 * generated artifacts are byte-stable across Windows/Linux/macOS hosts.
 * Anything outside this set is treated as opaque.
 */
const TEXT_EXTENSIONS = new Set<string>([
  '.md',
  '.mdc',
  '.mdx',
  '.markdown',
  '.txt',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.html',
  '.css',
]);

/** Dotfile basenames (no extension) that contain text and should be LF-normalized. */
const TEXT_DOTFILES = new Set<string>([
  '.gitignore',
  '.cursorignore',
  '.cursorindexingignore',
  '.aiignore',
  '.agentignore',
  '.clineignore',
  '.geminiignore',
  '.codeiumignore',
  '.continueignore',
  '.copilotignore',
  '.windsurfignore',
  '.junieignore',
  '.kiroignore',
  '.rooignore',
  '.antigravityignore',
]);

export function shouldNormalizeLineEndings(path: string): boolean {
  const ext = extname(path).toLowerCase();
  if (ext.length > 0) return TEXT_EXTENSIONS.has(ext);
  const base = basename(path).toLowerCase();
  return TEXT_DOTFILES.has(base);
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

/** Shell-script extensions whose generated files must carry an executable bit. */
const EXECUTABLE_SCRIPT_EXTENSIONS = new Set<string>(['.sh', '.bash', '.zsh']);

/**
 * Resolve the POSIX mode for a generated path. Returns `0o755` for shell
 * scripts so hooks emitted to disk are exec'able by the harness; returns
 * `undefined` for everything else, letting Node fall back to the default
 * write mode (umask-applied 0o644).
 */
export function executableModeFor(path: string): number | undefined {
  return EXECUTABLE_SCRIPT_EXTENSIONS.has(extname(path).toLowerCase()) ? 0o755 : undefined;
}

/**
 * The payload as writeFileAtomic lands it on disk: BOM stripped and CRLF
 * folded to LF for text files, untouched otherwise. Compare or hash through
 * this so in-memory content and its on-disk form never disagree.
 */
export function normalizeTextPayload(path: string, content: string): string {
  if (!shouldNormalizeLineEndings(path)) return content;
  const withoutBom = content.startsWith(UTF8_BOM) ? content.slice(UTF8_BOM.length) : content;
  return normalizeLineEndings(withoutBom);
}
