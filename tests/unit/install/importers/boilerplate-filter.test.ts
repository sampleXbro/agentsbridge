import { describe, it, expect } from 'vitest';
import {
  isBoilerplate,
  isNoiseBoilerplate,
  isPreservedBoilerplate,
  isRepoNonContentDir,
  isRepoNonContentFile,
} from '../../../../src/install/importers/boilerplate-filter.js';

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

describe('isPreservedBoilerplate — files kept as passive supporting content', () => {
  it('matches LICENSE variants (need to travel with redistributed content)', () => {
    expect(isPreservedBoilerplate('LICENSE')).toBe(true);
    expect(isPreservedBoilerplate('LICENSE.md')).toBe(true);
    expect(isPreservedBoilerplate('LICENSE.txt')).toBe(true);
    expect(isPreservedBoilerplate('LICENSE-MIT')).toBe(true);
    expect(isPreservedBoilerplate('LICENSE-APACHE.md')).toBe(true);
    expect(isPreservedBoilerplate('license-bsd.txt')).toBe(true);
  });

  it('matches NOTICE (required by Apache 2.0 attribution)', () => {
    expect(isPreservedBoilerplate('NOTICE')).toBe(true);
    expect(isPreservedBoilerplate('NOTICE.md')).toBe(true);
    expect(isPreservedBoilerplate('NOTICE.txt')).toBe(true);
  });

  it('matches COPYING / COPYRIGHT (common GPL/BSD attribution)', () => {
    expect(isPreservedBoilerplate('COPYING')).toBe(true);
    expect(isPreservedBoilerplate('COPYING.md')).toBe(true);
    expect(isPreservedBoilerplate('COPYRIGHT')).toBe(true);
  });

  it('matches README (skill-specific docs that explain context to the consumer)', () => {
    expect(isPreservedBoilerplate('README')).toBe(true);
    expect(isPreservedBoilerplate('README.md')).toBe(true);
    expect(isPreservedBoilerplate('readme.md')).toBe(true);
    expect(isPreservedBoilerplate('README.txt')).toBe(true);
  });

  it('does not match noise files (CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT, ...)', () => {
    expect(isPreservedBoilerplate('CHANGELOG.md')).toBe(false);
    expect(isPreservedBoilerplate('CONTRIBUTING.md')).toBe(false);
    expect(isPreservedBoilerplate('CODE_OF_CONDUCT.md')).toBe(false);
    expect(isPreservedBoilerplate('SECURITY.md')).toBe(false);
  });

  it('does not match arbitrary content files', () => {
    expect(isPreservedBoilerplate('SKILL.md')).toBe(false);
    expect(isPreservedBoilerplate('interview-me.md')).toBe(false);
    expect(isPreservedBoilerplate('_root.md')).toBe(false);
  });
});

describe('isNoiseBoilerplate — files dropped from skill supporting content', () => {
  it('matches CHANGELOG / CONTRIBUTING / community-health (NOT README anymore)', () => {
    expect(isNoiseBoilerplate('CHANGELOG.md')).toBe(true);
    expect(isNoiseBoilerplate('CONTRIBUTING.md')).toBe(true);
    expect(isNoiseBoilerplate('CODE_OF_CONDUCT.md')).toBe(true);
    expect(isNoiseBoilerplate('SECURITY.md')).toBe(true);
    expect(isNoiseBoilerplate('SUPPORT.md')).toBe(true);
    expect(isNoiseBoilerplate('AUTHORS')).toBe(true);
    expect(isNoiseBoilerplate('CODEOWNERS')).toBe(true);
  });

  it('does NOT match preserved files (LICENSE, NOTICE, COPYING, README)', () => {
    expect(isNoiseBoilerplate('LICENSE')).toBe(false);
    expect(isNoiseBoilerplate('LICENSE.md')).toBe(false);
    expect(isNoiseBoilerplate('LICENSE-MIT')).toBe(false);
    expect(isNoiseBoilerplate('NOTICE')).toBe(false);
    expect(isNoiseBoilerplate('COPYING')).toBe(false);
    expect(isNoiseBoilerplate('COPYRIGHT')).toBe(false);
    expect(isNoiseBoilerplate('README.md')).toBe(false);
  });

  it('does not match SKILL.md or arbitrary entity content', () => {
    expect(isNoiseBoilerplate('SKILL.md')).toBe(false);
    expect(isNoiseBoilerplate('interview-me.md')).toBe(false);
  });
});

describe('isBoilerplate — union of preserved + noise (entity discovery filter)', () => {
  it('returns true for ALL preserved files (never an entity, even though kept as supporting content)', () => {
    expect(isBoilerplate('LICENSE')).toBe(true);
    expect(isBoilerplate('NOTICE.md')).toBe(true);
    expect(isBoilerplate('COPYING')).toBe(true);
    expect(isBoilerplate('README.md')).toBe(true);
  });

  it('returns true for ALL noise files', () => {
    expect(isBoilerplate('CHANGELOG.md')).toBe(true);
    expect(isBoilerplate('CONTRIBUTING.md')).toBe(true);
  });
});

describe('isRepoNonContentDir', () => {
  it('matches VCS / tooling dirs', () => {
    expect(isRepoNonContentDir('.git')).toBe(true);
    expect(isRepoNonContentDir('.github')).toBe(true);
    expect(isRepoNonContentDir('.gitlab')).toBe(true);
    expect(isRepoNonContentDir('node_modules')).toBe(true);
    expect(isRepoNonContentDir('.vscode')).toBe(true);
    expect(isRepoNonContentDir('.idea')).toBe(true);
  });

  it('does not match canonical content dirs', () => {
    expect(isRepoNonContentDir('skills')).toBe(false);
    expect(isRepoNonContentDir('agents')).toBe(false);
    expect(isRepoNonContentDir('commands')).toBe(false);
    expect(isRepoNonContentDir('rules')).toBe(false);
    expect(isRepoNonContentDir('references')).toBe(false);
    expect(isRepoNonContentDir('.agentsmesh')).toBe(false);
  });
});

describe('isRepoNonContentFile', () => {
  it('matches lockfiles, package.json, dotfiles, OS noise', () => {
    expect(isRepoNonContentFile('package.json')).toBe(true);
    expect(isRepoNonContentFile('package-lock.json')).toBe(true);
    expect(isRepoNonContentFile('pnpm-lock.yaml')).toBe(true);
    expect(isRepoNonContentFile('yarn.lock')).toBe(true);
    expect(isRepoNonContentFile('.gitignore')).toBe(true);
    expect(isRepoNonContentFile('.gitattributes')).toBe(true);
    expect(isRepoNonContentFile('.editorconfig')).toBe(true);
    expect(isRepoNonContentFile('.DS_Store')).toBe(true);
  });

  it('does not match markdown content', () => {
    expect(isRepoNonContentFile('SKILL.md')).toBe(false);
    expect(isRepoNonContentFile('README.md')).toBe(false);
    expect(isRepoNonContentFile('agent.md')).toBe(false);
  });
});
