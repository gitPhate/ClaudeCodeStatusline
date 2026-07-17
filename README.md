# Claude Code Statusline

A custom status line for [Claude Code](https://docs.claude.com/en/docs/claude-code) that replaces the default line with a single, information-dense bar covering your repo, git state, context usage, rate limits, session cost, and more — all in 24-bit truecolor.

![statusline screenshot](./screenshot.png)

## What it shows

Reading left to right:

- 🤖 **Model** — display name, plus the reasoning effort level in parentheses when set (e.g. `Sonnet 5 (high)`)
- 🪟 **Context usage** — a 20-block gradient bar (green → yellow → red) with tokens used vs. max context window
- **Repo & branch** — repo name, current directory leaf (if different from the repo root), and the git branch, prefixed with 🌿
- **Dirty status** — counts of modified (`~`), untracked (`?`), added (`+`), and deleted (`-`) files
- **Lines changed** — `+added`/`-removed` line counts for the session
- **Rate limits** — 5-hour and 7-day usage percentages with an emoji threshold indicator (🟢/⚡️/🔥/🚨) and a reset countdown
- ⏱️ **Session duration** — cumulative wall-clock time for the current Claude Code session. Shown as `Xm Ys`, or `Xh Ym` once it passes 60 minutes.
- 💵 **Session cost** in USD

Colors and emoji thresholds scale automatically: usage under 20% is green, 20–70% is yellow/⚡️, 70–90% is orange/🔥, and 90%+ is red/🚨.

The branch name and repo name are truncated dynamically (with `…`) so the whole line always fits within the terminal width. Terminal width is detected from the `COLUMNS` environment variable Claude Code provides (since the script's stdout isn't a TTY, `process.stdout.columns` isn't available), falling back to parsing `mode con` on Windows when `COLUMNS` is unset, and finally a hardcoded 120 if neither is available. A fixed margin also accounts for the few columns of chrome Claude Code itself reserves around the rendered statusline row.

When the line is still too long, the **branch name shrinks first** (sized against the full, untruncated repo name); if that alone isn't enough to make room, the **repo name shrinks second** against whatever budget is left. A final whole-line safety net hard-truncates the entire rendered line as a last resort, so it can never overflow and get cut off mid-segment by the terminal itself.

## Files

- **`statusline.js`** — the primary, actively maintained implementation (Node.js, no dependencies beyond built-ins). Includes rate limits, effort level, session duration, cost, and dynamic branch/repo-name truncation.
- **`statusline.sh`** ⚠️ **obsolete** — an earlier, simpler bash/jq/awk implementation covering only the core repo/branch/context/cost/velocity/model segments. Superseded by `statusline.js`, which has since gained rate limits, effort level, session duration, dirty-status breakdown, and dynamic branch truncation that were never ported back to the bash version. Kept around for reference only; not recommended for new setups.

## Requirements

- **statusline.js**: Node.js (uses only `child_process` and `path` from the standard library)
- **statusline.sh** (obsolete, reference only): `bash`, `git`, `jq`, `awk`
- A terminal that supports 24-bit truecolor ANSI escapes and emoji rendering

## Setup

Claude Code reads status line configuration from your settings file (e.g. `~/.claude/settings.json` or a project's `.claude/settings.json`), and invokes the configured command with the session state as JSON on stdin.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /path/to/statusline.js"
  }
}
```

Or, for the obsolete bash version (not recommended, reference only):

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/statusline.sh"
  }
}
```

Restart Claude Code (or start a new session) for the change to take effect.

## How it works

Each script reads a single JSON blob from stdin — the shape Claude Code provides via its status line hook, including `model`, `workspace`, `context_window`, `cost`, `rate_limits`, and `effort` — and prints one ANSI-colored line to stdout. Git state (branch, dirty file counts) is shelled out to `git` against the session's working directory.

---

**AI Disclaimer:** _This repo is 100% written and maintained by Claude Code — every commit, feature, and this README included._
