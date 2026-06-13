---
'agentsmesh': patch
---

fix(install): retry the git-source cache finalize on Windows transient locks

Fetching a git `extends:`/`install` source could intermittently fail on Windows
with `EPERM: operation not permitted, rename '<cache>.tmp' -> '<cache>'`. The
fetcher finalizes the cache by renaming the freshly-cloned staging directory
into place; on Windows the just-exited `git clone` handle (or an antivirus /
search-indexer scan) can still pin those files for a few milliseconds, so the
rename is rejected. The finalize rename now retries on the transient codes
Windows raises (`EPERM`/`EACCES`/`EBUSY`/`ENOTEMPTY`/`EEXIST`) with a short
backoff, so the lock clears instead of surfacing a spurious "fetch failed".
POSIX behavior is unchanged (a single rename).
