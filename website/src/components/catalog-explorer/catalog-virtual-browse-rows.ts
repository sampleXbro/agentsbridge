import type { CatalogRow } from '../../lib/catalog-rows';
import { escHtml } from './catalog-dom';

export function colgroupHtml(): string {
  return `<colgroup>
    <col class="am-col-title" />
    <col class="am-col-desc" />
    <col class="am-col-link" />
  </colgroup>`;
}

export function spacerRow(heightPx: number): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = 'am-catalog-vspacer';
  tr.setAttribute('aria-hidden', 'true');
  const td = document.createElement('td');
  td.colSpan = 3;
  td.className = 'am-catalog-vspacer-cell';
  td.style.height = `${heightPx}px`;
  tr.appendChild(td);
  return tr;
}

export function buildDataRow(
  r: CatalogRow,
  index: number,
  selectedId: string,
): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = 'am-catalog-tr';
  tr.tabIndex = 0;
  tr.setAttribute('role', 'row');
  tr.dataset.amRow = String(index);
  if (r.i === selectedId) tr.classList.add('am-catalog-tr--selected');
  tr.innerHTML = `<td data-label="Title" class="am-catalog-td-title">${escHtml(r.t)}</td>
    <td data-label="Description" class="am-catalog-td-desc">${escHtml(r.d)}</td>`;
  const tdLink = document.createElement('td');
  tdLink.dataset.label = 'Source';
  tdLink.className = 'am-catalog-td-link';
  const a = document.createElement('a');
  a.href = r.l;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'am-catalog-src-link';
  a.textContent = 'Link';
  a.title = r.l;
  tdLink.appendChild(a);
  tr.appendChild(tdLink);
  a.addEventListener('click', (e) => e.stopPropagation());
  return tr;
}
