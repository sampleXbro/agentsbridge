import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { detectMarketplaceSubPacks } from '../../../../src/install/classify/marketplace-manifest.js';
import type { FlatSourceLayout, SubPack } from '../../../../src/install/classify/layout-types.js';

type DetectLayout = (path: string, relPrefix: string) => Promise<FlatSourceLayout>;
type HasContent = (layout: FlatSourceLayout) => boolean;

const EMPTY_LAYOUT: FlatSourceLayout = {
  canonical: null,
  skillPack: null,
  rootSkill: null,
  rootRule: null,
  flatCollections: [],
  toolNativeManifests: [],
};

let root: string;
let detectLayout: Mock<DetectLayout>;
let hasContent: Mock<HasContent>;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  detectLayout = vi.fn<DetectLayout>(async () => EMPTY_LAYOUT);
  hasContent = vi.fn<HasContent>(() => true);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeManifest(content: string): Promise<void> {
  await mkdir(join(root, '.claude-plugin'), { recursive: true });
  await writeFile(join(root, '.claude-plugin', 'marketplace.json'), content, 'utf-8');
}

function run(): Promise<SubPack[] | null> {
  return detectMarketplaceSubPacks(root, detectLayout, hasContent);
}

describe('detectMarketplaceSubPacks', () => {
  it('returns null when the manifest file is missing', async () => {
    await expect(run()).resolves.toBeNull();
    expect(detectLayout).not.toHaveBeenCalled();
  });

  it('returns null when the manifest is not valid JSON', async () => {
    await writeManifest('{ not json');
    await expect(run()).resolves.toBeNull();
    expect(detectLayout).not.toHaveBeenCalled();
  });

  it.each(['[]', '"str"', '{}', 'null', '{"plugins":"x"}'])(
    'returns null when the manifest is %s (no plugins array)',
    async (json) => {
      await writeManifest(json);
      await expect(run()).resolves.toBeNull();
      expect(detectLayout).not.toHaveBeenCalled();
    },
  );

  it('skips invalid plugin entries without probing their layout', async () => {
    await writeFile(join(root, 'plain.txt'), 'not a dir', 'utf-8');
    await writeManifest(
      JSON.stringify({
        plugins: [
          42,
          'str',
          null,
          {},
          { source: 7 },
          { source: '' },
          { source: './' },
          { source: '/abs' },
          { source: '../escape' },
          { source: 'sub/../escape' },
          { source: 'missing' },
          { source: 'plain.txt' },
        ],
      }),
    );
    await expect(run()).resolves.toEqual([]);
    expect(detectLayout).not.toHaveBeenCalled();
    expect(hasContent).not.toHaveBeenCalled();
  });

  it('normalizes `./sub/` to `sub` and includes it when hasContent is true', async () => {
    await mkdir(join(root, 'sub'));
    await writeManifest(JSON.stringify({ plugins: [{ source: './sub/' }] }));
    const layout: FlatSourceLayout = { ...EMPTY_LAYOUT, skillPack: { path: 'sub' } };
    detectLayout.mockResolvedValueOnce(layout);

    await expect(run()).resolves.toEqual([{ path: 'sub', layout }]);
    expect(detectLayout).toHaveBeenCalledTimes(1);
    expect(detectLayout).toHaveBeenCalledWith(join(root, 'sub'), 'sub');
    expect(hasContent).toHaveBeenCalledTimes(1);
    expect(hasContent).toHaveBeenCalledWith(layout);
  });

  it('drops sub-packs whose layout has no installable content', async () => {
    await mkdir(join(root, 'empty'));
    await mkdir(join(root, 'full'));
    await writeManifest(JSON.stringify({ plugins: [{ source: 'empty' }, { source: 'full/' }] }));
    const fullLayout: FlatSourceLayout = { ...EMPTY_LAYOUT, canonical: { path: 'full' } };
    detectLayout.mockImplementation(async (_path, rel) =>
      rel === 'full' ? fullLayout : EMPTY_LAYOUT,
    );
    hasContent.mockImplementation((layout) => layout.canonical !== null);

    await expect(run()).resolves.toEqual([{ path: 'full', layout: fullLayout }]);
    expect(detectLayout.mock.calls).toEqual([
      [join(root, 'empty'), 'empty'],
      [join(root, 'full'), 'full'],
    ]);
    expect(hasContent.mock.calls).toEqual([[EMPTY_LAYOUT], [fullLayout]]);
  });
});
