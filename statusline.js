#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));
var import_child_process = require("child_process"), path = __toESM(require("path"));
const SCRIPT_VERSION = "1.2.1";
process.argv.includes("--version") && (process.stdout.write(`${SCRIPT_VERSION}
`), process.exit(0));
let raw = "";
process.stdin.on("data", (chunk) => raw += chunk), process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    input = {};
  }
  const model = input?.model?.display_name || "unknown", cwd = input?.workspace?.current_dir || input?.cwd || ".", repoNameFromInput = input?.workspace?.repo?.name, usedPct = Number(input?.context_window?.used_percentage ?? 0) || 0, totalInputTokens = Number(input?.context_window?.total_input_tokens ?? 0) || 0, maxContextTokens = Number(input?.context_window?.max_tokens ?? input?.context_window?.context_window_size ?? 0) || (usedPct > 0 ? Math.round(totalInputTokens / (usedPct / 100)) : 0), linesAdded = Number(input?.cost?.total_lines_added ?? 0) || 0, linesRemoved = Number(input?.cost?.total_lines_removed ?? 0) || 0, rateLimitPct = input?.rate_limits?.five_hour?.used_percentage, weekLimitPct = input?.rate_limits?.seven_day?.used_percentage, rateLimitResetsAt = input?.rate_limits?.five_hour?.resets_at, weekLimitResetsAt = input?.rate_limits?.seven_day?.resets_at, effortLevel = input?.effort?.level || "", durationMs = Number(input?.cost?.total_duration_ms ?? 0) || 0, totalCostUsd = Number(input?.cost?.total_cost_usd ?? 0) || 0, repoName = repoNameFromInput || path.basename(cwd);
  let branch = "", modified = 0, untracked = 0, added = 0, deleted = 0;
  try {
    const statusLines = (0, import_child_process.execSync)("git status --porcelain --branch --untracked-files=all", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"]
    }).toString().split(`
`).filter(Boolean), header = (statusLines.shift() ?? "").slice(3);
    header.startsWith("HEAD (no branch)") ? branch = "HEAD" : !header.startsWith("No commits yet on ") && !header.startsWith("Initial commit on ") && (branch = header.split("...")[0].split(" [")[0]);
    for (const line of statusLines) {
      const x = line[0], y = line[1];
      x === "?" && y === "?" ? untracked++ : x === "D" || y === "D" ? deleted++ : x === "A" || y === "A" ? added++ : ("MRC".includes(x) || "MRC".includes(y)) && modified++;
    }
  } catch {
    branch = "";
  }
  const RESET = "\x1B[0m", fg24 = (r, g, b) => `\x1B[38;2;${r};${g};${b}m`, SEP = `${fg24(100, 100, 100)} | ${RESET}`;
  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }
  function gradientBlockColor(idx, total) {
    const t = total > 1 ? idx / (total - 1) : 0;
    let r, g, b;
    if (t <= 0.5) {
      const tt = t / 0.5;
      r = lerp(0, 220, tt), g = lerp(200, 200, tt), b = lerp(80, 0, tt);
    } else {
      const tt = (t - 0.5) / 0.5;
      r = lerp(220, 220, tt), g = lerp(200, 40, tt), b = lerp(0, 20, tt);
    }
    return [r, g, b];
  }
  function usageTrio(rawPct, label, totalBlocks = 20) {
    const pct = Math.max(0, Math.min(100, rawPct)), pctInt = Math.round(pct), filled = totalBlocks > 0 ? Math.max(0, Math.min(totalBlocks, Math.round(pct / 100 * totalBlocks))) : 0, empty = totalBlocks - filled;
    let emoji, lr, lg, lb;
    pctInt < 20 ? (emoji = "\u{1F7E2}", [lr, lg, lb] = [0, 200, 80]) : pctInt < 70 ? (emoji = "\u26A1\uFE0F", [lr, lg, lb] = [230, 180, 20]) : pctInt < 90 ? (emoji = "\u{1F525}", [lr, lg, lb] = [230, 100, 20]) : (emoji = "\u{1F6A8}", [lr, lg, lb] = [220, 40, 20]);
    let filledBar = "";
    for (let i = 0; i < filled; i++) {
      const [r, g, b] = gradientBlockColor(i, totalBlocks);
      filledBar += `${fg24(r, g, b)}\u2588`;
    }
    const emptyBar = empty > 0 ? `${fg24(60, 60, 60)}${"\u2588".repeat(empty)}` : "", bar = `${filledBar}${emptyBar}${RESET}`, labelPart = label ? `${fg24(150, 150, 150)}${label} ${RESET}` : "";
    return totalBlocks > 0 ? `${labelPart}${emoji} ${bar} ${fg24(lr, lg, lb)}${pctInt}%${RESET}` : `${labelPart}${emoji} ${fg24(lr, lg, lb)}${pctInt}%${RESET}`;
  }
  function formatResetIn(resetsAtSec) {
    if (resetsAtSec == null) return "";
    const diffMs = resetsAtSec * 1e3 - Date.now();
    if (diffMs <= 0) return "0m";
    const totalMin = Math.round(diffMs / 6e4), days = Math.floor(totalMin / 1440), hours = Math.floor(totalMin % 1440 / 60), mins = totalMin % 60;
    return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }
  function usagePct(rawPct, label) {
    const pct = Math.max(0, Math.min(100, rawPct)), pctInt = Math.round(pct);
    let emoji, lr, lg, lb;
    return pctInt < 20 ? (emoji = "\u{1F7E2}", [lr, lg, lb] = [0, 200, 80]) : pctInt < 70 ? (emoji = "\u26A1\uFE0F", [lr, lg, lb] = [230, 180, 20]) : pctInt < 90 ? (emoji = "\u{1F525}", [lr, lg, lb] = [230, 100, 20]) : (emoji = "\u{1F6A8}", [lr, lg, lb] = [220, 40, 20]), `${label ? `${fg24(150, 150, 150)}${label} ${RESET}` : ""}${emoji} ${fg24(lr, lg, lb)}${pctInt}%${RESET}`;
  }
  function formatTokenCount(n) {
    return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
  }
  function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  }
  function truncateAnsiToWidth(str, maxWidth) {
    if (maxWidth <= 0) return "";
    let visible = 0, out = "", i = 0;
    const ansiRe = /\x1b\[[0-9;]*m/y;
    for (; i < str.length; ) {
      ansiRe.lastIndex = i;
      const m = ansiRe.exec(str);
      if (m) {
        out += m[0], i += m[0].length;
        continue;
      }
      const code = str.charCodeAt(i), chunk = code >= 55296 && code <= 56319 && i + 1 < str.length ? str.slice(i, i + 2) : str[i];
      if (visible + chunk.length > maxWidth) break;
      out += chunk, visible += chunk.length, i += chunk.length;
    }
    return out;
  }
  function styledRepoName(name) {
    return `\x1B[1m${fg24(230, 200, 50)}${name}${RESET}`;
  }
  const leafName = path.basename(cwd), leafPart = leafName && leafName !== repoName ? `${fg24(150, 150, 150)}/${leafName}${RESET}` : "", dirtyPart = branch ? [
    modified > 0 ? `${fg24(230, 180, 20)}~${modified}${RESET}` : "",
    untracked > 0 ? `${fg24(150, 150, 150)}?${untracked}${RESET}` : "",
    added > 0 ? `${fg24(0, 200, 80)}+${added}${RESET}` : "",
    deleted > 0 ? `${fg24(220, 40, 20)}-${deleted}${RESET}` : ""
  ].filter(Boolean).join(" ") : "", branchPrefix = branch ? `\x1B[1m${fg24(0, 215, 215)}\u{1F33F} (` : "", branchSuffix = branch ? `)${RESET}` : "", worktreeName = input?.worktree?.name || input?.workspace?.git_worktree || "", hasWorktree = !!worktreeName, worktreePart = hasWorktree ? `${fg24(80, 220, 120)}\u{1F333} ${worktreeName}${RESET}` : "", contextLabel = maxContextTokens ? `\u{1FA9F} ${formatTokenCount(totalInputTokens)}/${formatTokenCount(maxContextTokens)}` : `\u{1FA9F} ${formatTokenCount(totalInputTokens)}`, velocityPart = `${fg24(150, 150, 150)}lines ${RESET}${fg24(0, 200, 80)}+${linesAdded}${RESET} ${fg24(220, 40, 20)}-${linesRemoved}${RESET}`, DOT = ` ${fg24(100, 100, 100)}\xB7${RESET} `;
  function resetBracket(resetsAtSec) {
    const resetIn = formatResetIn(resetsAtSec);
    return resetIn ? ` ${fg24(150, 150, 150)}(reset ${resetIn})${RESET}` : "";
  }
  const rateLimitSegments = [];
  rateLimitPct != null && rateLimitSegments.push(usagePct(Number(rateLimitPct), "5h") + resetBracket(rateLimitResetsAt)), weekLimitPct != null && rateLimitSegments.push(usagePct(Number(weekLimitPct), "7d") + resetBracket(weekLimitResetsAt));
  const rateLimitsPart = rateLimitSegments.join(DOT), effortPart = effortLevel ? ` (${effortLevel})` : "", modelPart = `${fg24(200, 80, 220)}\u{1F916} ${model}${effortPart}${RESET}`, durationSec = Math.floor(durationMs / 1e3), durationMin = Math.floor(durationSec / 60), durationSecRem = durationSec % 60, durationHours = Math.floor(durationMin / 60), durationMinRem = durationMin % 60, durationStr = durationHours > 0 ? `${durationHours}h ${durationMinRem}m` : `${durationMin}m ${durationSecRem}s`, clockPart = `${fg24(150, 150, 150)}\u23F1\uFE0F ${durationStr}${RESET}`, costPart = totalCostUsd > 0 ? `${fg24(150, 150, 150)}\u{1F4B5} $${totalCostUsd.toFixed(2)}${RESET}` : "";
  function detectTerminalWidth() {
    const envColumns = parseInt(process.env.COLUMNS ?? "", 10);
    if (envColumns > 0) return envColumns;
    if (process.platform === "win32")
      try {
        const match = (0, import_child_process.execSync)("mode con", { stdio: ["ignore", "pipe", "ignore"] }).toString().match(/Columns:\s*(\d+)/i), cols = match ? parseInt(match[1], 10) : NaN;
        if (cols > 0) return cols;
      } catch {
      }
    return 120;
  }
  const terminalWidth = detectTerminalWidth(), safetyMargin = 4, twoLine = terminalWidth < 160;
  function truncateToFit(text, available) {
    if (available <= 0) return "\u2026";
    if (text.length <= available) return text;
    const keep = Math.max(0, available - 1);
    return keep > 0 ? `${text.slice(0, keep)}\u2026` : "\u2026";
  }
  const MAX_BAR_BLOCKS = 20, trailingLineOneParts = twoLine ? [] : [velocityPart, rateLimitsPart, clockPart, costPart], contextPartZeroBar = usageTrio(usedPct, contextLabel, 0), modelContextPartZeroBar = [modelPart, contextPartZeroBar].filter(Boolean).join(" "), branchPlaceholderForBar = branch ? `${branchPrefix}${branch}${branchSuffix}` : "", repoPartForBar = [styledRepoName(repoName), leafPart, branchPlaceholderForBar, worktreePart, dirtyPart].filter(Boolean).join(" "), otherPartsForBar = [modelContextPartZeroBar, repoPartForBar, ...trailingLineOneParts].filter(Boolean), lengthWithoutBar = stripAnsi(otherPartsForBar.join(SEP)).length, barBudget = terminalWidth - safetyMargin - lengthWithoutBar - 1, barBlocks = hasWorktree ? 0 : Math.max(0, Math.min(MAX_BAR_BLOCKS, barBudget)), contextPart = usageTrio(usedPct, contextLabel, barBlocks), modelContextPart = [modelPart, contextPart].filter(Boolean).join(" "), branchPlaceholder = branch ? `${branchPrefix}${branchSuffix}` : "", repoPartWithBranchPlaceholder = [
    styledRepoName(repoName),
    leafPart,
    branchPlaceholder,
    worktreePart,
    dirtyPart
  ].filter(Boolean).join(" "), otherParts = [modelContextPart, repoPartWithBranchPlaceholder, ...trailingLineOneParts].filter(Boolean), baseLineVisibleLength = stripAnsi(otherParts.join(SEP)).length, truncatedBranch = branch && truncateToFit(branch, terminalWidth - baseLineVisibleLength - safetyMargin), branchPart = branch ? `${branchPrefix}${truncatedBranch}${branchSuffix}` : "", repoPartPlaceholder = [styledRepoName(""), leafPart, branchPart, worktreePart, dirtyPart].filter(Boolean).join(" "), partsWithRepoPlaceholder = [modelContextPart, repoPartPlaceholder, ...trailingLineOneParts].filter(Boolean), lengthWithoutRepoName = stripAnsi(partsWithRepoPlaceholder.join(SEP)).length, truncatedRepoName = truncateToFit(repoName, terminalWidth - lengthWithoutRepoName - safetyMargin), repoPart = [styledRepoName(truncatedRepoName), leafPart, branchPart, worktreePart, dirtyPart].filter(Boolean).join(" ");
  function hardTruncateToTerminal(line) {
    const visibleLength = stripAnsi(line).length, hardBudget = terminalWidth - safetyMargin;
    return hardBudget > 0 && visibleLength > hardBudget ? truncateAnsiToWidth(line, Math.max(0, hardBudget - 1)) + RESET + "\u2026" : line;
  }
  const lineOneParts = [modelContextPart, repoPart, ...trailingLineOneParts].filter(Boolean);
  let output = hardTruncateToTerminal(lineOneParts.join(SEP));
  if (twoLine) {
    const lineTwoParts = [velocityPart, rateLimitsPart, clockPart, costPart].filter(Boolean);
    lineTwoParts.length > 0 && (output += `
` + hardTruncateToTerminal(lineTwoParts.join(SEP)));
  }
  process.stdout.write(output + `
`);
});
