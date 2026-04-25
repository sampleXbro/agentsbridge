import { describe, expect, it } from 'vitest';
import {
  AgentsMeshError,
  ConfigNotFoundError,
  ConfigValidationError,
  FileSystemError,
  GenerationError,
  ImportError,
  LockAcquisitionError,
  RemoteFetchError,
  TargetNotFoundError,
} from '../../../src/core/errors.js';

describe('AgentsMeshError taxonomy', () => {
  it('base class carries a code and is an Error', () => {
    const err = new AgentsMeshError('AM_GENERATION_FAILED', 'boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AgentsMeshError);
    expect(err.code).toBe('AM_GENERATION_FAILED');
    expect(err.name).toBe('AgentsMeshError');
    expect(err.message).toBe('boom');
  });

  it('ConfigNotFoundError has stable code and retains agentsmesh.yaml cue', () => {
    const err = new ConfigNotFoundError('/x/agentsmesh.yaml');
    expect(err).toBeInstanceOf(AgentsMeshError);
    expect(err).toBeInstanceOf(ConfigNotFoundError);
    expect(err.code).toBe('AM_CONFIG_NOT_FOUND');
    expect(err.name).toBe('ConfigNotFoundError');
    expect(err.path).toBe('/x/agentsmesh.yaml');
    expect(err.message).toContain('not found');
    expect(err.message).toContain('agentsmesh.yaml');
    expect(err.message).toContain('/x/agentsmesh.yaml');
  });

  it('ConfigValidationError exposes issues array', () => {
    const err = new ConfigValidationError('/x/agentsmesh.yaml', ['bad targets', 'bad features']);
    expect(err.code).toBe('AM_CONFIG_INVALID');
    expect(err.issues).toEqual(['bad targets', 'bad features']);
    expect(err.message).toContain('bad targets; bad features');
  });

  it('TargetNotFoundError carries target id and optional supported list', () => {
    const err = new TargetNotFoundError('nope', { supported: ['cursor', 'claude-code'] });
    expect(err.code).toBe('AM_TARGET_NOT_FOUND');
    expect(err.target).toBe('nope');
    expect(err.message).toContain('cursor, claude-code');
  });

  it('ImportError, GenerationError, RemoteFetchError, LockAcquisitionError, FileSystemError preserve code and cause', () => {
    const rootCause = new Error('root');
    const importErr = new ImportError('claude-code', 'bad yaml', { cause: rootCause });
    expect(importErr.code).toBe('AM_IMPORT_FAILED');
    expect(importErr.target).toBe('claude-code');
    expect(importErr.cause).toBe(rootCause);

    const genErr = new GenerationError('oops', { cause: rootCause });
    expect(genErr.code).toBe('AM_GENERATION_FAILED');
    expect(genErr.cause).toBe(rootCause);

    const remoteErr = new RemoteFetchError('github:a/b@v1', 'net down');
    expect(remoteErr.code).toBe('AM_REMOTE_FETCH_FAILED');
    expect(remoteErr.source).toBe('github:a/b@v1');

    const lockErr = new LockAcquisitionError('/p/.generate.lock', 'pid 42');
    expect(lockErr.code).toBe('AM_LOCK_ACQUISITION_FAILED');
    expect(lockErr.lockPath).toBe('/p/.generate.lock');
    expect(lockErr.holder).toBe('pid 42');

    const fsErr = new FileSystemError('/p/x', 'denied', { errnoCode: 'EACCES' });
    expect(fsErr.code).toBe('AM_FILESYSTEM');
    expect(fsErr.path).toBe('/p/x');
    expect(fsErr.errnoCode).toBe('EACCES');
  });

  it('subclasses are all catchable as AgentsMeshError for consumers who want broad matching', () => {
    const errors = [
      new ConfigNotFoundError('/x'),
      new ConfigValidationError('/x', ['a']),
      new TargetNotFoundError('nope'),
      new ImportError('cursor', 'bad'),
      new GenerationError('oops'),
      new RemoteFetchError('s', 'm'),
      new LockAcquisitionError('/p', 'holder'),
      new FileSystemError('/p', 'm'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AgentsMeshError);
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.code).toBe('string');
      expect(err.code.startsWith('AM_')).toBe(true);
    }
  });
});
