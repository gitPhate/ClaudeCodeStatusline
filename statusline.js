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

  const folderPart = `\x1b[1m${fg24(230, 200, 50)}${repoName}${RESET}`;

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

  const branchPart = branch ? `\x1b[1m${fg24(0, 215, 215)}🌿 (${branch})${RESET}` : '';

  const repoPart = [folderPart, leafPart, branchPart, dirtyPart].filter(Boolean).join(' ');

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

  const parts = [modelContextPart, repoPart, velocityPart, rateLimitsPart, clockPart, costPart].filter(Boolean);

  process.stdout.write(parts.join(SEP) + '\n');
});
