/** Compact JSON row for homepage catalog (id, title, description, kind, link). */
export type CatalogRow = { i: string; t: string; d: string; k: string; l: string };

type RowSource = {
  id: string;
  title: string;
  description: string;
  kind: string;
  link: string;
};

export function toCatalogRows(items: readonly RowSource[]): CatalogRow[] {
  return items.map((x) => ({
    i: x.id,
    t: x.title,
    d: x.description,
    k: x.kind,
    l: x.link,
  }));
}
