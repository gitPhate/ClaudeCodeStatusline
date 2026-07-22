# Claude Code Statusline

This repo (`C:\Development\ai\ClaudeCodeStatusline\statusline.js`) is the source of truth, but Claude Code actually runs its live copy from `C:\Users\gabriele.ricci\.claude\statusline.js`.

**Any non-temporary edit to `statusline.js` must be applied to both copies** — the repo file and the running copy at `C:\Users\gabriele.ricci\.claude\statusline.js` — so they never drift out of sync. Temporary/experimental edits used only to test something in the moment don't need to be mirrored.

**Versioning**: the script has a `SCRIPT_VERSION` constant near the top (semver `major.minor.patch`), checkable at runtime via `node statusline.js --version`. Bump it on every non-temporary change to either copy — patch for bug fixes, minor for new/enhanced behavior, major for breaking changes to config or output format — and keep the number identical across both copies, same as the rest of the file.
