#!/usr/bin/env node
// Claude Code status line: repo | branch | context bar | usage | cost | velocity | model
// All colors are 24-bit truecolor ANSI escapes.

const { execSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }

  const model = input?.model?.display_name || 'unknown';
  const cwd = input?.workspace?.current_dir || input?.cwd || '.';
  const repoNameFromInput = input?.workspace?.repo?.name;
  const usedPct = Number(input?.context_window?.used_percentage ?? 0) || 0;
  const totalInputTokens = Number(input?.context_window?.total_input_tokens ?? 0) || 0;
  const maxContextTokens =
    Number(input?.context_window?.max_tokens ?? input?.context_window?.context_window_size ?? 0) ||
    (usedPct > 0 ? Math.round(totalInputTokens / (usedPct / 100)) : 0);
  const linesAdded = Number(input?.cost?.total_lines_added ?? 0) || 0;
  const linesRemoved = Number(input?.cost?.total_lines_removed ?? 0) || 0;
  const rateLimitPct = input?.rate_limits?.five_hour?.used_percentage;
  const weekLimitPct = input?.rate_limits?.seven_day?.used_percentage;
  const rateLimitResetsAt = input?.rate_limits?.five_hour?.resets_at;
  const weekLimitResetsAt = input?.rate_limits?.seven_day?.resets_at;
  const effortLevel = input?.effort?.level || '';
  const durationMs = Number(input?.cost?.total_duration_ms ?? 0) || 0;
  const totalCostUsd = Number(input?.cost?.total_cost_usd ?? 0) || 0;

  const repoName = repoNameFromInput || path.basename(cwd);

  let branch = '';
  let modified = 0;
  let untracked = 0;
  let added = 0;
  let deleted = 0;
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const statusLines = execSync('git status --porcelain --untracked-files=all', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .split('\n')
      .filter(Boolean);
    for (const line of statusLines) {
      const x = line[0];
      const y = line[1];
      if (x === '?' && y === '?') untracked++;
      else if (x === 'D' || y === 'D') deleted++;
      else if (x === 'A' || y === 'A') added++;
      else if ('MRC'.includes(x) || 'MRC'.includes(y)) modified++;
    }
  } catch {
    branch = '';
  }

  const RESET = '\x1b[0m';
  const fg24 = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
  const SEP = `${fg24(100, 100, 100)} | ${RESET}`;

  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  // Color for the block at position `idx` out of `total`, along a fixed
  // green -> yellow -> red gradient spanning the whole bar (position-based,
  // not value-based), same idea as the AKCodez gradient progress bar gist.
  function gradientBlockColor(idx, total) {
    const t = total > 1 ? idx / (total - 1) : 0;
    let r, g, b;
    if (t <= 0.5) {
      const tt = t / 0.5;
      r = lerp(0, 220, tt);
      g = lerp(200, 200, tt);
      b = lerp(80, 0, tt);
    } else {
      const tt = (t - 0.5) / 0.5;
      r = lerp(220, 220, tt);
      g = lerp(200, 40, tt);
      b = lerp(0, 20, tt);
    }
    return [r, g, b];
  }

  function usageTrio(rawPct, label) {
    const pct = Math.max(0, Math.min(100, rawPct));
    const pctInt = Math.round(pct);

    const totalBlocks = 20;
    const filled = Math.max(0, Math.min(totalBlocks, Math.round((pct / 100) * totalBlocks)));
    const empty = totalBlocks - filled;

    let emoji, lr, lg, lb;
    if (pctInt < 20) {
      emoji = '🟢';
      [lr, lg, lb] = [0, 200, 80];
    } else if (pctInt < 70) {
      emoji = '⚡️';
      [lr, lg, lb] = [230, 180, 20];
    } else if (pctInt < 90) {
      emoji = '🔥';
      [lr, lg, lb] = [230, 100, 20];
    } else {
      emoji = '🚨';
      [lr, lg, lb] = [220, 40, 20];
    }

    let filledBar = '';
    for (let i = 0; i < filled; i++) {
      const [r, g, b] = gradientBlockColor(i, totalBlocks);
      filledBar += `${fg24(r, g, b)}█`;
    }
    const emptyBar = `${fg24(60, 60, 60)}${'█'.repeat(empty)}`;
    const bar = `${filledBar}${emptyBar}${RESET}`;

    const labelPart = label ? `${fg24(150, 150, 150)}${label} ${RESET}` : '';
    return `${labelPart}${emoji} ${bar} ${fg24(lr, lg, lb)}${pctInt}%${RESET}`;
  }

  function formatResetIn(resetsAtSec) {
    if (resetsAtSec == null) return '';
    const diffMs = resetsAtSec * 1000 - Date.now();
    if (diffMs <= 0) return '0m';
    const totalMin = Math.round(diffMs / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function usagePct(rawPct, label) {
    const pct = Math.max(0, Math.min(100, rawPct));
    const pctInt = Math.round(pct);

    let emoji, lr, lg, lb;
    if (pctInt < 20) {
      emoji = '🟢';
      [lr, lg, lb] = [0, 200, 80];
    } else if (pctInt < 70) {
      emoji = '⚡️';
      [lr, lg, lb] = [230, 180, 20];
    } else if (pctInt < 90) {
      emoji = '🔥';
      [lr, lg, lb] = [230, 100, 20];
    } else {
      emoji = '🚨';
      [lr, lg, lb] = [220, 40, 20];
    }

    const labelPart = label ? `${fg24(150, 150, 150)}${label} ${RESET}` : '';
    return `${labelPart}${emoji} ${fg24(lr, lg, lb)}${pctInt}%${RESET}`;
  }

  function formatTokenCount(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  // Truncates an ANSI-colored string to at most `maxWidth` visible columns,
  // preserving escape sequences (which contribute 0 width) intact. Used as a
  // last-resort safety net so the whole line can never overflow the terminal,
  // regardless of which segment's width estimate was wrong.
  function truncateAnsiToWidth(str, maxWidth) {
    if (maxWidth <= 0) return '';
    let visible = 0;
    let out = '';
    let i = 0;
    const ansiRe = /\x1b\[[0-9;]*m/y;
    while (i < str.length) {
      ansiRe.lastIndex = i;
      const m = ansiRe.exec(str);
      if (m) {
        out += m[0];
        i += m[0].length;
        continue;
      }
      if (visible >= maxWidth) break;
      const code = str.charCodeAt(i);
      const isHighSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < str.length;
      const chunk = isHighSurrogate ? str.slice(i, i + 2) : str[i];
      out += chunk;
      visible += chunk.length;
      i += chunk.length;
    }
    return out;
  }

  function styledRepoName(name) {
    return `\x1b[1m${fg24(230, 200, 50)}${name}${RESET}`;
  }

  const leafName = path.basename(cwd);
  const leafPart = leafName && leafName !== repoName ? `${fg24(150, 150, 150)}/${leafName}${RESET}` : '';

  const dirtyPart = branch
    ? [
        modified > 0 ? `${fg24(230, 180, 20)}~${modified}${RESET}` : '',
        untracked > 0 ? `${fg24(150, 150, 150)}?${untracked}${RESET}` : '',
        added > 0 ? `${fg24(0, 200, 80)}+${added}${RESET}` : '',
        deleted > 0 ? `${fg24(220, 40, 20)}-${deleted}${RESET}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  const branchPrefix = branch ? `\x1b[1m${fg24(0, 215, 215)}🌿 (` : '';
  const branchSuffix = branch ? `)${RESET}` : '';

  const contextLabel = maxContextTokens
    ? `🪟 ${formatTokenCount(totalInputTokens)}/${formatTokenCount(maxContextTokens)}`
    : `🪟 ${formatTokenCount(totalInputTokens)}`;
  const contextPart = usageTrio(usedPct, contextLabel);

  const velocityPart = `${fg24(150, 150, 150)}lines ${RESET}${fg24(0, 200, 80)}+${linesAdded}${RESET} ${fg24(220, 40, 20)}-${linesRemoved}${RESET}`;

  const DOT = ` ${fg24(100, 100, 100)}·${RESET} `;

  function resetBracket(resetsAtSec) {
    const resetIn = formatResetIn(resetsAtSec);
    return resetIn ? ` ${fg24(150, 150, 150)}(reset ${resetIn})${RESET}` : '';
  }

  const rateLimitSegments = [];
  if (rateLimitPct != null) {
    rateLimitSegments.push(usagePct(Number(rateLimitPct), '5h') + resetBracket(rateLimitResetsAt));
  }
  if (weekLimitPct != null) {
    rateLimitSegments.push(usagePct(Number(weekLimitPct), '7d') + resetBracket(weekLimitResetsAt));
  }
  const rateLimitsPart = rateLimitSegments.join(DOT);

  const effortPart = effortLevel ? ` (${effortLevel})` : '';

  const modelPart = `${fg24(200, 80, 220)}🤖 ${model}${effortPart}${RESET}`;

  const durationSec = Math.floor(durationMs / 1000);
  const durationMin = Math.floor(durationSec / 60);
  const durationSecRem = durationSec % 60;
  const durationHours = Math.floor(durationMin / 60);
  const durationMinRem = durationMin % 60;
  const durationStr =
    durationHours > 0 ? `${durationHours}h ${durationMinRem}m` : `${durationMin}m ${durationSecRem}s`;
  const clockPart = `${fg24(150, 150, 150)}⏱️ ${durationStr}${RESET}`;

  const modelContextPart = [modelPart, contextPart].filter(Boolean).join(' ');

  const costPart = totalCostUsd > 0 ? `${fg24(150, 150, 150)}💵 $${totalCostUsd.toFixed(2)}${RESET}` : '';

  // Determine how much room is left for the branch name so the WHOLE status
  // line fits within the terminal width, instead of a fixed character cap.
  // Claude Code captures this script's stdout rather than connecting it to the
  // terminal, so process.stdout.columns is always undefined here — the real
  // width normally comes via the COLUMNS env var Claude Code sets before
  // invoking us, with a Windows console fallback below when that's missing.
  function detectTerminalWidth() {
    const envColumns = parseInt(process.env.COLUMNS, 10);
    if (envColumns > 0) return envColumns;

    // COLUMNS is a shell-exported variable (bash/zsh convention). It's not a
    // standard Windows environment variable, so when this script is invoked
    // through cmd.exe/PowerShell rather than a bash-like shell it may simply
    // be absent. Ask the console directly in that case before giving up.
    if (process.platform === 'win32') {
      try {
        const out = execSync('mode con', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const match = out.match(/Columns:\s*(\d+)/i);
        const cols = match ? parseInt(match[1], 10) : NaN;
        if (cols > 0) return cols;
      } catch {
        // no attached console (e.g. output is fully redirected) — fall through
      }
    }

    return 120;
  }

  const terminalWidth = detectTerminalWidth();
  // Claude Code reserves its own chrome around the rendered statusline row
  // (measured empirically: a 209-column terminal only rendered 205 columns
  // of content before Claude Code applied its own cutoff) — this isn't a
  // fudge factor for our own width-estimation error, it's content Claude
  // Code claims for itself regardless of what we report as the line length.
  const safetyMargin = 4;

  // Truncates `text` to at most `available` visible characters, appending a
  // single-character ellipsis instead of the removed tail. Used for both the
  // branch name and the repo name, whichever needs to shrink to make the
  // whole line fit the terminal width.
  function truncateToFit(text, available) {
    if (available <= 0) return '…';
    if (text.length <= available) return text;
    const keep = Math.max(0, available - 1);
    return keep > 0 ? `${text.slice(0, keep)}…` : '…';
  }

  // Branch shrinks first, sized against the full (untruncated) repo name.
  const branchPlaceholder = branch ? `${branchPrefix}${branchSuffix}` : '';
  const repoPartWithBranchPlaceholder = [styledRepoName(repoName), leafPart, branchPlaceholder, dirtyPart]
    .filter(Boolean)
    .join(' ');
  const otherParts = [
    modelContextPart,
    repoPartWithBranchPlaceholder,
    velocityPart,
    rateLimitsPart,
    clockPart,
    costPart,
  ].filter(Boolean);
  const baseLineVisibleLength = stripAnsi(otherParts.join(SEP)).length;

  const truncatedBranch = branch
    ? truncateToFit(branch, terminalWidth - baseLineVisibleLength - safetyMargin)
    : branch;
  const branchPart = branch ? `${branchPrefix}${truncatedBranch}${branchSuffix}` : '';

  // Repo name shrinks second, against the actual remaining budget once the
  // branch above is already final — so a short repo name only gets
  // truncated if shrinking the branch alone still wasn't enough.
  const repoPartPlaceholder = [styledRepoName(''), leafPart, branchPart, dirtyPart].filter(Boolean).join(' ');
  const partsWithRepoPlaceholder = [
    modelContextPart,
    repoPartPlaceholder,
    velocityPart,
    rateLimitsPart,
    clockPart,
    costPart,
  ].filter(Boolean);
  const lengthWithoutRepoName = stripAnsi(partsWithRepoPlaceholder.join(SEP)).length;
  const truncatedRepoName = truncateToFit(repoName, terminalWidth - lengthWithoutRepoName - safetyMargin);
  const folderPart = styledRepoName(truncatedRepoName);

  const repoPart = [folderPart, leafPart, branchPart, dirtyPart].filter(Boolean).join(' ');

  const parts = [modelContextPart, repoPart, velocityPart, rateLimitsPart, clockPart, costPart].filter(Boolean);

  let finalLine = parts.join(SEP);

  // Final safety net: even if the branch-name truncation above under-estimated
  // (stale/unavailable terminal width, emoji-width quirks, etc.), make sure the
  // rendered line can never overflow the terminal and get hard-cut mid-segment
  // by it. This trims from the right (rather than the branch) as a last resort.
  const finalVisibleLength = stripAnsi(finalLine).length;
  const hardBudget = terminalWidth - safetyMargin;
  if (hardBudget > 0 && finalVisibleLength > hardBudget) {
    finalLine = truncateAnsiToWidth(finalLine, Math.max(0, hardBudget - 1)) + RESET + '…';
  }

  process.stdout.write(finalLine + '\n');
});
