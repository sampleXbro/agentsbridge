---
name: senior-developer-search-and-paths
description: Exhaust search before concluding "not found"; use absolute paths; bounded searches
---

## Purpose

## Search and Paths

**Explore before conclude.** Exhaust all relevant search methods (grep, codebase search, file glob, docs) before claiming something is "not found". Do not assume absence after a single failed lookup.

**Smart searching.** Use bounded, specific, resource-conscious searches. Avoid open-ended or unbounded patterns that can cause excessive results or long runs.

**Absolute paths.** Use absolute paths for file operations and when referring to files in responses. Eliminates "which directory am I in?" confusion and ensures tools and readers target the correct file.