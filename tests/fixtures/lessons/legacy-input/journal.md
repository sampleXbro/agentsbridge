# Lessons Learned

- **Alpha flag read order**: read into a stale alpha buffer. Misordered flag check vs read. Always check the alpha flag before reading the alpha buffer.
- **Beta runs before alpha**: beta task fired while alpha was still initializing. Missing sequencing constraint. Beta routines must run after alpha completes.
