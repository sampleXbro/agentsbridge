import type { CatalogRow } from '../../lib/catalog-rows';
import { bindCopyButton } from '../../lib/copy-to-clipboard';
import { libraryInstallCommand, packInstallCommand } from '../../lib/install-command.mjs';
import { mountVirtualBrowse, type VirtualBrowseHandle } from './catalog-virtual-browse';

export type CatalogPayload = {
  skills: CatalogRow[];
  agents: CatalogRow[];
  commands: CatalogRow[];
};

const LIVE_ACK_MS = 2500;
const SEARCH_DEBOUNCE_MS = 100;
type TabId = 'skills' | 'agents' | 'commands';

const EMPTY_FILTER_MSG = 'No matches. Try other words or another tab.';

function tabRows(data: CatalogPayload, tab: TabId): CatalogRow[] {
  return data[tab];
}

function matchesQuery(row: CatalogRow, q: string): boolean {
  const b = (s: string): boolean => s.toLowerCase().includes(q);
  return b(row.t) || b(row.d) || b(row.l) || b(row.k) || b(row.i);
}

export function mountCatalogExplorer(root: HTMLElement, data: CatalogPayload): void {
  const copyInput = root.querySelector<HTMLInputElement>('[data-am-copy-input]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-am-copy-btn]');
  const installGlobalEl = root.querySelector<HTMLInputElement>('[data-am-install-global]');
  const search = root.querySelector<HTMLInputElement>('[data-am-search]');
  const tableWrap = root.querySelector<HTMLElement>('[data-am-table-wrap]');
  const live = root.querySelector<HTMLElement>('[data-am-live]');
  const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-am-tab]');

  if (!copyInput || !copyBtn || !installGlobalEl || !search || !tableWrap || !live) return;

  let tab: TabId = 'skills';
  let installGlobal = installGlobalEl.checked;
  let lastPicked: CatalogRow | null = null;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let virtualBrowse: VirtualBrowseHandle | null = null;

  function setLiveMessage(msg: string): void {
    if (liveTimer !== undefined) clearTimeout(liveTimer);
    live.textContent = msg;
    if (msg) {
      liveTimer = setTimeout(() => {
        live.textContent = '';
        liveTimer = undefined;
      }, LIVE_ACK_MS);
    }
  }

  function refreshCommandLine(): void {
    copyInput.value = lastPicked
      ? packInstallCommand({ link: lastPicked.l, kind: tab, global: installGlobal })
      : libraryInstallCommand(installGlobal);
  }

  function applyPick(row: CatalogRow): void {
    lastPicked = row;
    refreshCommandLine();
  }

  function clearSearchDebounce(): void {
    if (searchTimer !== undefined) {
      clearTimeout(searchTimer);
      searchTimer = undefined;
    }
  }

  function applyTable(): void {
    const q = search.value.trim().toLowerCase();
    const all = tabRows(data, tab);
    const filtered = q.length > 0 ? all.filter((x) => matchesQuery(x, q)) : all;
    const browseOpts =
      q.length > 0 && filtered.length === 0 ? { emptyMessage: EMPTY_FILTER_MSG } : undefined;

    tableWrap.hidden = false;
    if (!virtualBrowse) {
      virtualBrowse = mountVirtualBrowse(tableWrap, filtered, applyPick, browseOpts);
    } else {
      virtualBrowse.setRows(filtered, browseOpts);
    }
  }

  function scheduleSearchTable(): void {
    clearSearchDebounce();
    searchTimer = setTimeout(() => {
      searchTimer = undefined;
      applyTable();
    }, SEARCH_DEBOUNCE_MS);
  }

  function setTab(next: TabId): void {
    tab = next;
    lastPicked = null;
    refreshCommandLine();
    search.value = '';
    clearSearchDebounce();
    setLiveMessage('');
    tabButtons.forEach((btn) => {
      const id = btn.getAttribute('data-am-tab') as TabId | null;
      btn.setAttribute('aria-selected', String(id === next));
    });
    applyTable();
  }

  bindCopyButton(copyBtn, {
    getText: () => copyInput.value,
    onCopied: () => setLiveMessage('Copied to clipboard'),
  });

  installGlobalEl.addEventListener('change', () => {
    installGlobal = installGlobalEl.checked;
    refreshCommandLine();
  });

  search.addEventListener('input', scheduleSearchTable);
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-am-tab') as TabId | null;
      if (id === 'skills' || id === 'agents' || id === 'commands') setTab(id);
    });
  });

  refreshCommandLine();
  applyTable();
}
