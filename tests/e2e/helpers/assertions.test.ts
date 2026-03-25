/**
 * Unit tests for E2E assertion helpers.
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  fileExists,
  fileNotExists,
  fileContains,
  fileNotContains,
  validYaml,
  validJson,
  assertDirsEquivalent,
} from './assertions.js';

const TEST_DIR = join(tmpdir(), 'ab-assert-' + randomBytes(4).toString('hex'));

describe('fileExists', () => {
  it('passes when file exists', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'a.txt'), '');
    expect(() => fileExists(join(TEST_DIR, 'a.txt'))).not.toThrow();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('throws when file missing', () => {
    expect(() => fileExists(join(TEST_DIR, 'missing.txt'))).toThrow('Expected file to exist');
  });
});

describe('fileNotExists', () => {
  it('passes when file missing', () => {
    expect(() => fileNotExists(join(TEST_DIR, 'missing.txt'))).not.toThrow();
  });

  it('throws when file exists', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'b.txt'), 'x');
    expect(() => fileNotExists(join(TEST_DIR, 'b.txt'))).toThrow('Expected file to not exist');
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('fileContains', () => {
  it('passes when substring present', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'c.txt'), 'hello world');
    expect(() => fileContains(join(TEST_DIR, 'c.txt'), 'world')).not.toThrow();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('throws when substring absent', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'd.txt'), 'hello');
    expect(() => fileContains(join(TEST_DIR, 'd.txt'), 'xyz')).toThrow('to contain');
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('fileNotContains', () => {
  it('passes when substring absent', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'e.txt'), 'hello');
    expect(() => fileNotContains(join(TEST_DIR, 'e.txt'), 'xyz')).not.toThrow();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('throws when substring present', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'f.txt'), 'hello world');
    expect(() => fileNotContains(join(TEST_DIR, 'f.txt'), 'world')).toThrow('to NOT contain');
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('validYaml', () => {
  it('passes for valid YAML', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'g.yaml'), 'version: 1\nkey: value');
    expect(() => validYaml(join(TEST_DIR, 'g.yaml'))).not.toThrow();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('throws for invalid YAML', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'h.yaml'), 'key: [unclosed');
    expect(() => validYaml(join(TEST_DIR, 'h.yaml'))).toThrow('Invalid YAML');
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('validJson', () => {
  it('passes for valid JSON', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'i.json'), '{"a": 1}');
    expect(() => validJson(join(TEST_DIR, 'i.json'))).not.toThrow();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('throws for invalid JSON', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'j.json'), '{invalid}');
    expect(() => validJson(join(TEST_DIR, 'j.json'))).toThrow('Invalid JSON');
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});

describe('assertDirsEquivalent', () => {
  it('passes when structure and content match', () => {
    const a = join(tmpdir(), 'equiv-a-' + randomBytes(4).toString('hex'));
    const b = join(tmpdir(), 'equiv-b-' + randomBytes(4).toString('hex'));
    mkdirSync(join(a, 'sub'), { recursive: true });
    mkdirSync(join(b, 'sub'), { recursive: true });
    writeFileSync(join(a, 'x.txt'), 'same\n');
    writeFileSync(join(b, 'x.txt'), 'same\n');
    writeFileSync(join(a, 'sub', 'y.txt'), 'content');
    writeFileSync(join(b, 'sub', 'y.txt'), 'content');
    expect(() => assertDirsEquivalent(a, b)).not.toThrow();
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });

  it('throws when structure differs', () => {
    const a = join(tmpdir(), 'diff-a-' + randomBytes(4).toString('hex'));
    const b = join(tmpdir(), 'diff-b-' + randomBytes(4).toString('hex'));
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'only-in-a.txt'), '');
    expect(() => assertDirsEquivalent(a, b)).toThrow('Dir structure mismatch');
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });

  it('throws when content differs', () => {
    const a = join(tmpdir(), 'cnt-a-' + randomBytes(4).toString('hex'));
    const b = join(tmpdir(), 'cnt-b-' + randomBytes(4).toString('hex'));
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'f.txt'), 'v1');
    writeFileSync(join(b, 'f.txt'), 'v2');
    expect(() => assertDirsEquivalent(a, b)).toThrow('Content mismatch');
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });

  it('ignores specified files', () => {
    const a = join(tmpdir(), 'ign-a-' + randomBytes(4).toString('hex'));
    const b = join(tmpdir(), 'ign-b-' + randomBytes(4).toString('hex'));
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'same.txt'), 'x');
    writeFileSync(join(b, 'same.txt'), 'x');
    writeFileSync(join(a, '.lock'), 'lock-a');
    writeFileSync(join(b, '.lock'), 'lock-b');
    expect(() => assertDirsEquivalent(a, b, { ignoreFiles: ['.lock'] })).not.toThrow();
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });

  it('ignores nested paths like .agentsbridge/.lock', () => {
    const a = join(tmpdir(), 'nested-a-' + randomBytes(4).toString('hex'));
    const b = join(tmpdir(), 'nested-b-' + randomBytes(4).toString('hex'));
    mkdirSync(join(a, '.agentsbridge'), { recursive: true });
    mkdirSync(join(b, '.agentsbridge'), { recursive: true });
    writeFileSync(join(a, 'x.txt'), 'same');
    writeFileSync(join(b, 'x.txt'), 'same');
    writeFileSync(join(a, '.agentsbridge', '.lock'), 'lock-a');
    writeFileSync(join(b, '.agentsbridge', '.lock'), 'lock-b');
    expect(() =>
      assertDirsEquivalent(a, b, { ignoreFiles: ['.agentsbridge/.lock'] }),
    ).not.toThrow();
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  });
});
