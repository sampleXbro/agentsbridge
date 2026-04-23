import type { CatalogRow } from '../../lib/catalog-rows';
import { mountVirtualBrowse, type VirtualBrowseHandle } from './catalog-virtual-browse';

export type CatalogPayload = {
  skills: CatalogRow[];
  agents: CatalogRow[];
  commands: CatalogRow[];
};

const DEFAULT_CMD = 'pnpm install agentsmesh';
/** User-level CLI install (`pnpm add --global` is the supported global form). */
const DEFAULT_CMD_GLOBAL = 'pnpm add --global agentsmesh';
const TARGET = 'claude-code';
const COPY_UI_MS = 2200;
const LIVE_ACK_MS = 2500;
const SEARCH_DEBOUNCE_MS = 100;
type TabId = 'skills' | 'agents' | 'commands';

const COPY_LABEL_DEFAULT = 'Copy';
const COPY_LABEL_DONE = 'Copied ✓';

const EMPTY_FILTER_MSG = 'No matches — try different words or another tab.';

function shellSingleQuoted(url: string): string {
  return url.replace(/'/g, `'\\''`);
}

function installCommand(link: string, asKind: TabId, global: boolean): string {
  const globalFlag = global ? ' --global' : '';
  return `agentsmesh install${globalFlag} '${shellSingleQuoted(link)}' --target ${TARGET} --as ${asKind}`;
}

function defaultLibCommand(global: boolean): string {
  return global ? DEFAULT_CMD_GLOBAL : DEFAULT_CMD;
}

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
  const copyLabel = root.querySelector<HTMLElement>('[data-am-copy-label]');
  const installGlobalEl = root.querySelector<HTMLInputElement>('[data-am-install-global]');
  const search = root.querySelector<HTMLInputElement>('[data-am-search]');
  const tableWrap = root.querySelector<HTMLElement>('[data-am-table-wrap]');
  const live = root.querySelector<HTMLElement>('[data-am-live]');
  const tabButtons = root.querySelectorAll<HTMLButtonElement>('[data-am-tab]');

  if (!copyInput || !copyBtn || !copyLabel || !installGlobalEl || !search || !tableWrap || !live)
    return;

  let tab: TabId = 'skills';
  let installGlobal = installGlobalEl.checked;
  let lastPicked: CatalogRow | null = null;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let copyUiTimer: ReturnType<typeof setTimeout> | undefined;
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

  function showCopyButtonDone(): void {
    if (copyUiTimer !== undefined) clearTimeout(copyUiTimer);
    copyBtn.classList.add('am-catalog-copy-btn--copied');
    copyLabel.textContent = COPY_LABEL_DONE;
    copyUiTimer = setTimeout(() => {
      copyBtn.classList.remove('am-catalog-copy-btn--copied');
      copyLabel.textContent = COPY_LABEL_DEFAULT;
      copyUiTimer = undefined;
    }, COPY_UI_MS);
  }

  function applyPick(row: CatalogRow): void {
    lastPicked = row;
    copyInput.value = installCommand(row.l, tab, installGlobal);
  }

  function refreshCommandLine(): void {
    if (lastPicked) {
      copyInput.value = installCommand(lastPicked.l, tab, installGlobal);
    } else {
      copyInput.value = defaultLibCommand(installGlobal);
    }
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
    copyInput.value = defaultLibCommand(installGlobal);
    search.value = '';
    clearSearchDebounce();
    setLiveMessage('');
    if (copyUiTimer !== undefined) {
      clearTimeout(copyUiTimer);
      copyUiTimer = undefined;
    }
    copyBtn.classList.remove('am-catalog-copy-btn--copied');
    copyLabel.textContent = COPY_LABEL_DEFAULT;
    tabButtons.forEach((btn) => {
      const id = btn.getAttribute('data-am-tab') as TabId | null;
      btn.setAttribute('aria-selected', String(id === next));
    });
    applyTable();
  }

  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(copyInput.value).then(
      () => {
        showCopyButtonDone();
        setLiveMessage('Copied to clipboard');
      },
      () => {
        copyInput.select();
        document.execCommand('copy');
        showCopyButtonDone();
        setLiveMessage('Copied to clipboard');
      },
    );
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

  copyInput.value = defaultLibCommand(installGlobal);
  applyTable();
}
