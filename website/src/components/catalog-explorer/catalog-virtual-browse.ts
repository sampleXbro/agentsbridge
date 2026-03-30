import type { CatalogRow } from '../../lib/catalog-rows';
import { buildDataRow, colgroupHtml, spacerRow } from './catalog-virtual-browse-rows';

/** Must match `.am-catalog-tr` fixed row height in CSS */
export const VIRTUAL_ROW_HEIGHT_PX = 52;
const OVERSCAN = 5;
const VISIBLE_BODY_ROWS = 3;
const DEFAULT_EMPTY = 'No items in this tab.';

export type VirtualBrowseHandle = {
  teardown: () => void;
  setRows: (rows: readonly CatalogRow[], options?: VirtualBrowseOptions) => void;
};

export type VirtualBrowseOptions = {
  emptyMessage?: string;
};

export function mountVirtualBrowse(
  wrap: HTMLElement,
  rows: readonly CatalogRow[],
  onPick: (row: CatalogRow) => void,
  options?: VirtualBrowseOptions,
): VirtualBrowseHandle {
  let rowRef: readonly CatalogRow[] = rows;
  let emptyMsgRef = options?.emptyMessage ?? DEFAULT_EMPTY;

  wrap.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'am-catalog-table-scroll am-catalog-table-scroll--virtual';
  scroll.setAttribute('data-am-table-scroll', '');
  const table = document.createElement('table');
  table.className = 'am-catalog-table am-catalog-table--body';
  table.innerHTML = `${colgroupHtml()}<thead class="am-catalog-thead-sticky"><tr>
    <th scope="col">Title</th>
    <th scope="col">Description</th>
    <th scope="col">Source</th>
  </tr></thead>`;
  const thead = table.querySelector('thead') as HTMLTableSectionElement;
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  scroll.appendChild(table);
  wrap.appendChild(scroll);

  function syncScrollMaxHeight(): void {
    const h = thead.offsetHeight;
    scroll.style.maxHeight = `${h + VISIBLE_BODY_ROWS * VIRTUAL_ROW_HEIGHT_PX}px`;
  }

  let selectedId = '';
  let raf = 0;
  let ro: ResizeObserver | undefined;

  function paint(): void {
    const rowsNow = rowRef;
    const theadH = thead.offsetHeight;
    if (rowsNow.length === 0) {
      tbody.replaceChildren();
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'am-catalog-table-empty';
      td.textContent = emptyMsgRef;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const rh = VIRTUAL_ROW_HEIGHT_PX;
    const st = scroll.scrollTop;
    const ch = scroll.clientHeight;
    const bodyTop = theadH;
    const bodyEnd = bodyTop + rowsNow.length * rh;
    const viewBot = st + ch;
    const iTop = Math.max(st, bodyTop);
    const iBot = Math.min(viewBot, bodyEnd);

    let start = 0;
    let end = rowsNow.length;
    if (iBot > iTop) {
      start = Math.max(0, Math.floor((iTop - bodyTop) / rh));
      end = Math.min(rowsNow.length, Math.ceil((iBot - bodyTop) / rh));
    } else {
      start = 0;
      end = 0;
    }
    start = Math.max(0, start - OVERSCAN);
    end = Math.min(rowsNow.length, end + OVERSCAN);

    const topPad = start * rh;
    const botPad = (rowsNow.length - end) * rh;

    const frag = document.createDocumentFragment();
    if (topPad > 0) frag.appendChild(spacerRow(topPad));
    for (let i = start; i < end; i++) {
      frag.appendChild(buildDataRow(rowsNow[i], i, selectedId));
    }
    if (botPad > 0) frag.appendChild(spacerRow(botPad));
    tbody.replaceChildren(frag);
  }

  function schedulePaint(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      paint();
    });
  }

  function onTbodyClick(e: MouseEvent): void {
    const tr = (e.target as HTMLElement).closest('tr.am-catalog-tr');
    if (!tr?.dataset.amRow) return;
    if ((e.target as HTMLElement).closest('a')) return;
    const idx = Number(tr.dataset.amRow);
    const row = rowRef[idx];
    if (!row) return;
    selectedId = row.i;
    onPick(row);
    schedulePaint();
  }

  function onTbodyKeydown(e: KeyboardEvent): void {
    const tr = (e.target as HTMLElement).closest('tr.am-catalog-tr');
    if (!tr?.dataset.amRow) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const idx = Number(tr.dataset.amRow);
    const row = rowRef[idx];
    if (!row) return;
    selectedId = row.i;
    onPick(row);
    schedulePaint();
  }

  tbody.addEventListener('click', onTbodyClick);
  tbody.addEventListener('keydown', onTbodyKeydown);
  scroll.addEventListener('scroll', schedulePaint, { passive: true });

  ro = new ResizeObserver(() => {
    syncScrollMaxHeight();
    schedulePaint();
  });
  ro.observe(scroll);
  ro.observe(thead);

  requestAnimationFrame(() => {
    syncScrollMaxHeight();
    schedulePaint();
  });

  return {
    teardown: (): void => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      scroll.removeEventListener('scroll', schedulePaint);
      tbody.removeEventListener('click', onTbodyClick);
      tbody.removeEventListener('keydown', onTbodyKeydown);
    },
    setRows: (next: readonly CatalogRow[], opts?: VirtualBrowseOptions) => {
      rowRef = next;
      emptyMsgRef = opts?.emptyMessage ?? DEFAULT_EMPTY;
      if (selectedId !== '' && !rowRef.some((r) => r.i === selectedId)) selectedId = '';
      scroll.scrollTop = 0;
      syncScrollMaxHeight();
      schedulePaint();
    },
  };
}
