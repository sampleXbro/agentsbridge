/**
 * Detect the SPDX identifier of a LICENSE-file body.
 *
 * Conservative: we only return an id when the text matches a well-known
 * fingerprint (canonical permission phrase or the verbatim version banner)
 * or carries an explicit `SPDX-License-Identifier:` line. Everything else
 * resolves to `null`, so the surfacing layer can say "unknown" rather than
 * misattribute exotic terms — important because the user makes redistribution
 * decisions on this label.
 *
 * Detection is text-pattern only: no network, no SPDX deep-text match. The
 * detector is intentionally small (~80 LOC) and lives outside `boilerplate-
 * filter.ts` so the legal-attribution policy has a single, isolated owner.
 */

type SpdxId =
  | 'MIT'
  | 'Apache-2.0'
  | 'BSD-3-Clause'
  | 'BSD-2-Clause'
  | 'GPL-3.0'
  | 'GPL-2.0'
  | 'LGPL-3.0'
  | 'LGPL-2.1'
  | 'AGPL-3.0'
  | 'MPL-2.0'
  | 'ISC'
  | 'CC0-1.0'
  | 'Unlicense';

const SPDX_HEADER = /spdx-license-identifier:\s*([A-Za-z0-9.+-]+)/i;

const FINGERPRINTS: ReadonlyArray<{ id: SpdxId; pattern: RegExp }> = [
  // BSD-3-Clause must be tested before BSD-2-Clause: the clause-3 phrase is the
  // discriminator, and the 2-clause body is a strict prefix of the 3-clause body.
  {
    id: 'BSD-3-Clause',
    pattern:
      /redistribution and use in source and binary forms[\s\S]+?neither the name of[\s\S]+?contributors/i,
  },
  {
    id: 'BSD-2-Clause',
    pattern: /redistribution and use in source and binary forms/i,
  },
  // AGPL/LGPL must precede GPL: their banners contain "GENERAL PUBLIC LICENSE"
  // too, so the plain-GPL test would otherwise win.
  { id: 'AGPL-3.0', pattern: /gnu affero general public license[\s\S]+?version 3/i },
  { id: 'LGPL-3.0', pattern: /gnu lesser general public license[\s\S]+?version 3/i },
  { id: 'LGPL-2.1', pattern: /gnu lesser general public license[\s\S]+?version 2\.1/i },
  { id: 'GPL-3.0', pattern: /gnu general public license[\s\S]+?version 3/i },
  { id: 'GPL-2.0', pattern: /gnu general public license[\s\S]+?version 2/i },
  { id: 'MPL-2.0', pattern: /mozilla public license[\s\S]+?version 2\.0/i },
  { id: 'Apache-2.0', pattern: /apache license[\s\S]+?version 2\.0/i },
  {
    id: 'MIT',
    pattern: /permission is hereby granted, free of charge, to any person obtaining a copy/i,
  },
  // ISC is older and has a near-MIT permission grant but the wording differs.
  { id: 'ISC', pattern: /permission to use, copy, modify,? and\/or distribute this software/i },
  {
    id: 'Unlicense',
    pattern: /this is free and unencumbered software released into the public domain/i,
  },
  { id: 'CC0-1.0', pattern: /cc0 1\.0 universal/i },
];

/**
 * Returns the SPDX identifier inferred from a license-file body, or `null`
 * when no fingerprint matches. The body may be the raw bytes of a `LICENSE`,
 * `LICENSE.md`, `LICENSE.txt`, `NOTICE`, etc.
 */
export function detectSpdxLicense(text: string): string | null {
  if (text.trim().length === 0) return null;
  const headerMatch = SPDX_HEADER.exec(text);
  if (headerMatch) return headerMatch[1] ?? null;
  for (const { id, pattern } of FINGERPRINTS) {
    if (pattern.test(text)) return id;
  }
  return null;
}
