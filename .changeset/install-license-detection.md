---
'agentsmesh': minor
---

feat(install): detect upstream SPDX license at pack-creation time and surface it in `agentsmesh installs list`

Every `agentsmesh install <source>` now probes the materialized pack root for a `LICENSE` / `COPYING` / `NOTICE` / `COPYRIGHT` file (across `.md` / `.txt` / `.rst` / no-extension variants) and runs a conservative SPDX detector against the bytes. The detector recognizes the dozen most common OSI/SPDX licenses by their canonical text fingerprints (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, GPL-2.0, GPL-3.0, LGPL-2.1, LGPL-3.0, AGPL-3.0, MPL-2.0, ISC, CC0-1.0, Unlicense) plus the explicit `SPDX-License-Identifier:` header. Unknown text resolves to `null` — better to say "unknown" than mislabel exotic terms.

The detected identifier is recorded in `pack.yaml#license`, propagated through `InstallsListEntry`, and rendered as a new `LICENSE` column in `agentsmesh installs list` (and JSON output). Lets you scan installed packs and spot proprietary or unknown-terms upstreams at a glance before relying on them.

Pack metadata schema is additive (`license` is optional) and prior `pack.yaml` files keep parsing — no migration needed.
