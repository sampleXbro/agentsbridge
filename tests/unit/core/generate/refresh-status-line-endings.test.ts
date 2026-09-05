/** On-disk text is LF-normalized at write time, so status must compare normalized forms. */
import { describe, it, expect } from 'vitest';
import { refreshResultStatus } from '../../../../src/core/generate/collision.js';
import type { GenerateResult } from '../../../../src/core/types.js';

function result(path: string, content: string, currentContent: string | undefined): GenerateResult {
  return {
    target: 'claude-code',
    feature: 'rules',
    path,
    content,
    status: 'updated',
    currentContent,
  } as GenerateResult;
}

describe('refreshResultStatus: line-ending and BOM aware', () => {
  it('reports a CRLF canonical body as unchanged against its LF file on disk', () => {
    expect(refreshResultStatus(result('CLAUDE.md', 'a\r\nb\r\n', 'a\nb\n')).status).toBe(
      'unchanged',
    );
  });

  it('ignores a UTF-8 BOM the writer strips', () => {
    expect(refreshResultStatus(result('CLAUDE.md', '﻿a\n', 'a\n')).status).toBe('unchanged');
  });

  it('still reports real content changes', () => {
    expect(refreshResultStatus(result('CLAUDE.md', 'a\r\nc\r\n', 'a\nb\n')).status).toBe('updated');
  });

  it('keeps byte comparison for files the writer does not normalize', () => {
    expect(refreshResultStatus(result('logo.png', 'a\r\n', 'a\n')).status).toBe('updated');
  });

  it('reports created when nothing exists on disk', () => {
    expect(refreshResultStatus(result('CLAUDE.md', 'a\n', undefined)).status).toBe('created');
  });
});
