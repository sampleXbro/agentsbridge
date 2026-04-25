import { describe, it, expect } from 'vitest';
import {
  assertSharedArtifactOwnersUnique,
  findSharedArtifactOwnershipConflicts,
  ownerTargetIdForSharedPath,
} from '../../../../src/targets/catalog/shared-artifact-owner.js';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

function fakeDescriptor(id: string, shared: TargetDescriptor['sharedArtifacts']): TargetDescriptor {
  return { id, sharedArtifacts: shared } as unknown as TargetDescriptor;
}

describe('shared-artifact-owner', () => {
  describe('findSharedArtifactOwnershipConflicts', () => {
    it('reports no conflicts for the live builtin set', () => {
      expect(findSharedArtifactOwnershipConflicts(BUILTIN_TARGETS)).toEqual([]);
    });

    it('detects two targets claiming the identical owner prefix', () => {
      const conflicts = findSharedArtifactOwnershipConflicts([
        fakeDescriptor('alpha', { '.agents/skills/': 'owner' }),
        fakeDescriptor('beta', { '.agents/skills/': 'owner' }),
      ]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        a: { targetId: 'alpha', prefix: '.agents/skills/' },
        b: { targetId: 'beta', prefix: '.agents/skills/' },
      });
    });

    it('detects overlapping prefixes (one is prefix of the other)', () => {
      const conflicts = findSharedArtifactOwnershipConflicts([
        fakeDescriptor('alpha', { '.agents/': 'owner' }),
        fakeDescriptor('beta', { '.agents/skills/': 'owner' }),
      ]);
      expect(conflicts).toHaveLength(1);
    });

    it('does not report conflicts when one role is consumer', () => {
      const conflicts = findSharedArtifactOwnershipConflicts([
        fakeDescriptor('alpha', { '.agents/skills/': 'owner' }),
        fakeDescriptor('beta', { '.agents/skills/': 'consumer' }),
      ]);
      expect(conflicts).toEqual([]);
    });

    it('does not report conflicts for disjoint owner prefixes', () => {
      const conflicts = findSharedArtifactOwnershipConflicts([
        fakeDescriptor('alpha', { '.agents/skills/': 'owner' }),
        fakeDescriptor('beta', { '.claude/skills/': 'owner' }),
      ]);
      expect(conflicts).toEqual([]);
    });
  });

  describe('assertSharedArtifactOwnersUnique', () => {
    it('throws with both target IDs and both prefixes when there is a conflict', () => {
      expect(() =>
        assertSharedArtifactOwnersUnique([
          fakeDescriptor('alpha', { '.agents/skills/': 'owner' }),
          fakeDescriptor('beta', { '.agents/skills/': 'owner' }),
        ]),
      ).toThrowError(/alpha.*\.agents\/skills\/.*beta.*\.agents\/skills\//s);
    });

    it('does not throw for the live builtin set', () => {
      expect(() => assertSharedArtifactOwnersUnique(BUILTIN_TARGETS)).not.toThrow();
    });
  });

  describe('ownerTargetIdForSharedPath', () => {
    it('returns codex-cli for paths under .agents/skills/', () => {
      expect(ownerTargetIdForSharedPath('.agents/skills/x/SKILL.md')).toBe('codex-cli');
    });

    it('returns null when no builtin owns the prefix', () => {
      expect(ownerTargetIdForSharedPath('.unrelated/path')).toBeNull();
    });
  });
});
