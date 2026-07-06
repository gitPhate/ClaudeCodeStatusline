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
  const added = Number(input?.cost?.total_lines_added ?? 0) || 0;
  const removed = Number(input?.cost?.total_lines_removed ?? 0) || 0;
  const rateLimitPct = input?.rate_limits?.five_hour?.used_percentage;
  const effortLevel = input?.effort?.level || '';

  const repoName = repoNameFromInput || path.basename(cwd);

  let branch = '';
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
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

  function usageTrio(rawPct) {
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
      emoji = '⚡';
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

    return `${emoji} ${bar} ${fg24(lr, lg, lb)}${pctInt}%${RESET}`;
  }

  const repoPart = `\x1b[1m${fg24(230, 200, 50)}${repoName}${RESET}`;

  const branchPart = branch ? `\x1b[1m${fg24(0, 215, 215)}🌿 (${branch})${RESET}` : '';

  const contextPart = usageTrio(usedPct);

  const velocityPart = `${fg24(0, 200, 80)}+${added}${RESET} ${fg24(220, 40, 20)}-${removed}${RESET}`;

  const rateLimitPart = rateLimitPct != null ? usageTrio(Number(rateLimitPct)) : '';

  const effortPart = effortLevel ? ` ${effortLevel}` : '';

  const modelPart = `${fg24(200, 80, 220)}🤖 ${model}${effortPart}${RESET}`;

  const parts = [repoPart, branchPart, contextPart, velocityPart, rateLimitPart, modelPart].filter(Boolean);

  process.stdout.write(parts.join(SEP) + '\n');
});
