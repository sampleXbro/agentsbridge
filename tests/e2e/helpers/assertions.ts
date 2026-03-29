/**
 * E2E assertion helpers for file/dir checks.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * Assert file exists. Throws if missing.
 */
export function fileExists(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Expected file to exist: ${path}`);
  }
}

/**
 * Assert file does not exist. Throws if it exists.
 */
export function fileNotExists(path: string): void {
  if (existsSync(path)) {
    throw new Error(`Expected file to not exist: ${path}`);
  }
}

/**
 * Assert file content contains substring.
 */
export function fileContains(path: string, substring: string): void {
  fileExists(path);
  const content = readFileSync(path, 'utf-8');
  if (!content.includes(substring)) {
    throw new Error(`Expected "${path}" to contain "${substring}". Got:\n${content.slice(0, 200)}`);
  }
}

/**
 * Assert file content does not contain substring.
 */
export function fileNotContains(path: string, substring: string): void {
  fileExists(path);
  const content = readFileSync(path, 'utf-8');
  if (content.includes(substring)) {
    throw new Error(`Expected "${path}" to NOT contain "${substring}"`);
  }
}

export function readText(path: string): string {
  fileExists(path);
  return readFileSync(path, 'utf-8');
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readText(path)) as Record<string, unknown>;
}

export function readYaml(path: string): Record<string, unknown> {
  return (parseYaml(readText(path)) as Record<string, unknown>) ?? {};
}

export function listRelativeFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    throw new Error(`Expected directory to exist: ${dir}`);
  }
  return [...readDirRecursive(dir).keys()].sort();
}

export function dirFilesExactly(dir: string, expectedRelativePaths: string[]): void {
  const actual = listRelativeFiles(dir);
  const expected = [...expectedRelativePaths].sort();
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(
      `Expected exact files in ${dir}.\nExpected: ${expected.join(', ') || '(none)'}\nActual: ${actual.join(', ') || '(none)'}`,
    );
  }
}

export function listRelativeEntries(dir: string): string[] {
  if (!existsSync(dir)) {
    throw new Error(`Expected directory to exist: ${dir}`);
  }
  return readTreeRecursive(dir).sort();
}

export function dirTreeExactly(dir: string, expectedRelativeEntries: string[]): void {
  const actual = listRelativeEntries(dir);
  const expected = [...expectedRelativeEntries].sort();
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(
      `Expected exact tree in ${dir}.\nExpected: ${expected.join(', ') || '(none)'}\nActual: ${actual.join(', ') || '(none)'}`,
    );
  }
}

/**
 * Assert file content matches snapshot. Uses Vitest's toMatchSnapshot.
 * Call from within a test: expect(content).toMatchSnapshot(snapshotName)
 */
export function fileMatchesSnapshot(path: string, _snapshotName: string): string {
  fileExists(path);
  const content = readFileSync(path, 'utf-8');
  return content;
}

/**
 * Assert file is valid YAML (parses without error).
 */
export function validYaml(path: string): void {
  fileExists(path);
  try {
    parseYaml(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Invalid YAML at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      {
        cause: err,
      },
    );
  }
}

/**
 * Assert file is valid JSON (parses without error).
 */
export function validJson(path: string): void {
  fileExists(path);
  try {
    JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Invalid JSON at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      {
        cause: err,
      },
    );
  }
}

function readDirRecursive(dir: string, base = ''): Map<string, string> {
  const result = new Map<string, string>();
  const currentPath = base ? join(dir, base) : dir;
  const entries = readdirSync(currentPath, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = join(dir, rel);
    if (e.isDirectory()) {
      for (const [k, v] of readDirRecursive(dir, rel)) {
        result.set(k, v);
      }
    } else {
      result.set(rel, readFileSync(full, 'utf-8'));
    }
  }
  return result;
}

function readTreeRecursive(dir: string, base = ''): string[] {
  const currentPath = base ? join(dir, base) : dir;
  const entries = readdirSync(currentPath, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(`${rel}/`);
      result.push(...readTreeRecursive(dir, rel));
      continue;
    }
    result.push(rel);
  }
  return result;
}

function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

/**
 * Assert two directories have equivalent structure and content.
 * @param ignoreFiles - Relative paths to ignore (e.g. ['.lock'])
 */
export function assertDirsEquivalent(
  dirA: string,
  dirB: string,
  options?: { ignoreFiles?: string[] },
): void {
  const ignore = new Set(options?.ignoreFiles ?? []);
  const mapA = readDirRecursive(dirA);
  const mapB = readDirRecursive(dirB);

  const filesA = [...mapA.keys()].filter((f) => !ignore.has(f)).sort();
  const filesB = [...mapB.keys()].filter((f) => !ignore.has(f)).sort();

  if (filesA.join(',') !== filesB.join(',')) {
    const onlyA = filesA.filter((f) => !filesB.includes(f));
    const onlyB = filesB.filter((f) => !filesA.includes(f));
    throw new Error(
      `Dir structure mismatch.\nOnly in A: ${onlyA.join(', ') || '(none)'}\nOnly in B: ${onlyB.join(', ') || '(none)'}`,
    );
  }

  for (const f of filesA) {
    const a = normalize(mapA.get(f)!);
    const b = normalize(mapB.get(f)!);
    if (a !== b) {
      throw new Error(
        `Content mismatch in ${f}:\n--- A ---\n${a.slice(0, 300)}\n--- B ---\n${b.slice(0, 300)}`,
      );
    }
  }
}
