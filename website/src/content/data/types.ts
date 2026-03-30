export type CatalogKind = 'skill' | 'rule' | 'agent' | 'command';
export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  kind: CatalogKind;
  link: string;
}
