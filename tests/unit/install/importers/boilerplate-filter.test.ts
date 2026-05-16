import { describe, it, expect } from 'vitest';
import { isBoilerplate } from '../../../../src/install/importers/boilerplate-filter.js';

describe('isBoilerplate', () => {
  describe('README variants', () => {
    it('matches README.md', () => {
      expect(isBoilerplate('README.md')).toBe(true);
    });

    it('matches lowercase readme.md', () => {
      expect(isBoilerplate('readme.md')).toBe(true);
    });

    it('matches uppercase README.MD', () => {
      expect(isBoilerplate('README.MD')).toBe(true);
    });

    it('matches mixed-case Readme.md', () => {
      expect(isBoilerplate('Readme.md')).toBe(true);
    });

    it('matches README without extension', () => {
      expect(isBoilerplate('README')).toBe(true);
    });

    it('matches README.rst', () => {
      expect(isBoilerplate('README.rst')).toBe(true);
    });

    it('matches README.txt', () => {
      expect(isBoilerplate('README.txt')).toBe(true);
    });
  });

  describe('LICENSE variants', () => {
    it('matches LICENSE.md', () => {
      expect(isBoilerplate('LICENSE.md')).toBe(true);
    });

    it('matches LICENSE without extension', () => {
      expect(isBoilerplate('LICENSE')).toBe(true);
    });

    it('matches LICENSE-MIT', () => {
      expect(isBoilerplate('LICENSE-MIT')).toBe(true);
    });

    it('matches LICENSE-APACHE.md', () => {
      expect(isBoilerplate('LICENSE-APACHE.md')).toBe(true);
    });

    it('matches LICENSE.txt', () => {
      expect(isBoilerplate('LICENSE.txt')).toBe(true);
    });
  });

  describe('community-health files', () => {
    it('matches CONTRIBUTING.md', () => {
      expect(isBoilerplate('CONTRIBUTING.md')).toBe(true);
    });

    it('matches CHANGELOG.md', () => {
      expect(isBoilerplate('CHANGELOG.md')).toBe(true);
    });

    it('matches CODE_OF_CONDUCT.md', () => {
      expect(isBoilerplate('CODE_OF_CONDUCT.md')).toBe(true);
    });

    it('matches code_of_conduct.md (case-insensitive)', () => {
      expect(isBoilerplate('code_of_conduct.md')).toBe(true);
    });

    it('matches SECURITY.md', () => {
      expect(isBoilerplate('SECURITY.md')).toBe(true);
    });

    it('matches SUPPORT.md', () => {
      expect(isBoilerplate('SUPPORT.md')).toBe(true);
    });

    it('matches MAINTAINERS.md', () => {
      expect(isBoilerplate('MAINTAINERS.md')).toBe(true);
    });

    it('matches GOVERNANCE.md', () => {
      expect(isBoilerplate('GOVERNANCE.md')).toBe(true);
    });

    it('matches AUTHORS', () => {
      expect(isBoilerplate('AUTHORS')).toBe(true);
    });

    it('matches CODEOWNERS', () => {
      expect(isBoilerplate('CODEOWNERS')).toBe(true);
    });

    it('matches NOTICE.md', () => {
      expect(isBoilerplate('NOTICE.md')).toBe(true);
    });

    it('matches CITATION.cff', () => {
      expect(isBoilerplate('CITATION.cff')).toBe(true);
    });
  });

  describe('entity filenames (must NOT match)', () => {
    it('does not match kebab-case entity names', () => {
      expect(isBoilerplate('interview-me.md')).toBe(false);
      expect(isBoilerplate('code-reviewer.md')).toBe(false);
      expect(isBoilerplate('build.md')).toBe(false);
      expect(isBoilerplate('test-engineer.md')).toBe(false);
      expect(isBoilerplate('security-and-hardening.md')).toBe(false);
    });

    it('does not match _root.md (canonical root rule)', () => {
      expect(isBoilerplate('_root.md')).toBe(false);
    });

    it('does not match files whose stem only starts with a boilerplate prefix', () => {
      expect(isBoilerplate('readme-extension.md')).toBe(false);
      expect(isBoilerplate('license-checker.md')).toBe(false);
    });

    it('does not match SKILL.md (special skill content file)', () => {
      expect(isBoilerplate('SKILL.md')).toBe(false);
    });
  });

  describe('non-markdown noise files (out of scope; not matched by markdown filter)', () => {
    it('does not match .gitignore', () => {
      expect(isBoilerplate('.gitignore')).toBe(false);
    });

    it('does not match package.json', () => {
      expect(isBoilerplate('package.json')).toBe(false);
    });

    it('does not match .DS_Store', () => {
      expect(isBoilerplate('.DS_Store')).toBe(false);
    });
  });
});
