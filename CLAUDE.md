# Claude Code Statusline

**Source is `statusline.ts`.** Edit it, then run `npm run build` (typechecks with tsc, bundles with esbuild into the committed `statusline.js`). The command stays `node statusline.js` — no TS at runtime. Below, "`statusline.js`" means the compiled output; bump `SCRIPT_VERSION` in the `.ts`.

This repo (`C:\Development\ai\ClaudeCodeStatusline\statusline.js`) is the source of truth, but Claude Code actually runs its live copy from `C:\Users\gabriele.ricci\.claude\statusline.js`.

**Any non-temporary edit to `statusline.js` must be applied to both copies** — the repo file and the running copy at `C:\Users\gabriele.ricci\.claude\statusline.js` — so they never drift out of sync. Temporary/experimental edits used only to test something in the moment don't need to be mirrored.

**Versioning**: the script has a `SCRIPT_VERSION` constant near the top (semver `major.minor.patch`), checkable at runtime via `node statusline.js --version`. Bump it on every non-temporary change to either copy — patch for bug fixes, minor for new/enhanced behavior, major for breaking changes to config or output format — and keep the number identical across both copies, same as the rest of the file.

**Releasing**: whenever `SCRIPT_VERSION` is bumped and the change is committed/pushed, also cut a GitHub release for it:

1. Tag the commit that bumped the version: `git tag -a vX.Y.Z <commit> -m "vX.Y.Z"` and `git push origin vX.Y.Z`.
2. Draft the changelog by hand from the commits since the previous tag (`git log --format="%H %s%n%b" <prev-tag>..vX.Y.Z`) — don't rely on `gh release create --generate-notes` alone, since this repo has no PRs and it only produces a bare compare link.
3. Create the release with the hand-written changelog, then append the `--generate-notes` compare link at the end so the raw diff link is still available:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
   ## Changelog

   - <bullet per notable change since the last tag>

   **Full Changelog**: https://github.com/gitPhate/ClaudeCodeStatusline/compare/<prev-tag>...vX.Y.Z
   EOF
   )"
   ```
