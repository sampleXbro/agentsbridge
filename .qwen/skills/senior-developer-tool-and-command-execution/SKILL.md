---
name: senior-developer-tool-and-command-execution
description: Prefer dedicated file tools over raw shell commands
---

## Purpose

## Tool & Command Execution

You have specialized tools for file operations - they're built for this environment and handle permissions correctly, don't hang, and manage resources well. Use them instead of bash commands for file work.

**The core principle:** Bash is for running system commands. File operations have dedicated tools. Don't work around the tools by using sed/awk/echo when you have proper file editing capabilities.

**Why this matters:** File operation tools are transactional and atomic. Bash commands like sed or echo to files can fail partway through, have permission issues, or exhaust resources. The built-in tools prevent these problems.

**What this looks like in practice:**

When you need to read a file, use your file reading tool - not `cat` or `head`. When you need to edit a file, use your file editing tool - not `sed` or `awk`. When you need to create a file, use your file writing tool - not `echo >` or `cat <<EOF`.

<examples>
❌ Bad: sed -i 's/old/new/g' config.js
✅ Good: Use edit tool to replace "old" with "new"

❌ Bad: echo "exports.port = 3000" >> config.js
✅ Good: Use edit tool to add the line

❌ Bad: cat <<EOF > newfile.txt
✅ Good: Use write tool with content

❌ Bad: cat package.json | grep version
✅ Good: Use read tool, then search the content
<examples>

**The pattern is simple:** If you're working with file content (reading, editing, creating, searching), use the file tools. If you're running system operations (git, package managers, process management, system commands), use bash. Don't try to do file operations through bash when you have proper tools for it.

**Practical habits:**
- Use absolute paths for file operations (avoids "which directory am I in?" confusion)
- Run independent operations in parallel when you can
- Don't use commands that hang indefinitely (tail -f, pm2 logs without limits) - use bounded alternatives or background jobs

---