#!/usr/bin/env bash
# Claude Code status line - repo | branch | context bar | usage | cost | velocity | model
# All colors use 24-bit truecolor ANSI escapes (rendered via printf %b at the end).

input=$(cat)

model=$(printf '%s' "$input" | jq -r '.model.display_name // "unknown"')
cwd=$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // "."')
repo_name_json=$(printf '%s' "$input" | jq -r '.workspace.repo.name // empty')
used_pct=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // 0')
cost=$(printf '%s' "$input" | jq -r '.cost.total_cost_usd // 0')
added=$(printf '%s' "$input" | jq -r '.cost.total_lines_added // 0')
removed=$(printf '%s' "$input" | jq -r '.cost.total_lines_removed // 0')

# repo name: prefer repo metadata, fall back to directory name
if [ -n "$repo_name_json" ]; then
  repo_name="$repo_name_json"
else
  repo_name=$(basename "$cwd")
fi

# git branch (empty if not a repo)
branch=""
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
fi

# normalize percentage to an int 0-100 for thresholds/bar math
pct_int=$(awk -v p="$used_pct" 'BEGIN{
  if (p == "" ) p = 0
  v = p + 0.5
  if (v < 0) v = 0
  if (v > 100) v = 100
  printf "%d", v
}')

# 20-block usage bar
total_blocks=20
filled=$(awk -v p="$used_pct" -v t="$total_blocks" 'BEGIN{
  if (p == "") p = 0
  if (p < 0) p = 0
  if (p > 100) p = 100
  f = int((p/100.0)*t + 0.5)
  if (f < 0) f = 0
  if (f > t) f = t
  printf "%d", f
}')
empty=$((total_blocks - filled))

# gradient color for filled blocks: green(0,200,80) -> yellow(220,200,0) -> red(220,40,20)
color_line=$(awk -v p="$used_pct" 'BEGIN{
  if (p == "") p = 0
  if (p < 0) p = 0
  if (p > 100) p = 100
  if (p <= 50) {
    t = p/50.0
    r = 0 + t*220
    g = 200
    b = 80 - t*80
  } else {
    t = (p-50)/50.0
    r = 220
    g = 200 - t*160
    b = 0 + t*20
  }
  printf "%d %d %d", r, g, b
}')
read -r fr fg fb <<< "$color_line"

# emoji + label color by usage threshold
if [ "$pct_int" -lt 20 ]; then
  emoji="🟢"; lr=0; lg=200; lb=80
elif [ "$pct_int" -lt 70 ]; then
  emoji="⚡"; lr=230; lg=180; lb=20
elif [ "$pct_int" -lt 90 ]; then
  emoji="🔥"; lr=230; lg=100; lb=20
else
  emoji="🚨"; lr=220; lg=40; lb=20
fi

# build filled/empty bar strings
filled_bar=""
i=0
while [ "$i" -lt "$filled" ]; do filled_bar="${filled_bar}█"; i=$((i+1)); done
empty_bar=""
i=0
while [ "$i" -lt "$empty" ]; do empty_bar="${empty_bar}█"; i=$((i+1)); done

cost_fmt=$(awk -v c="$cost" 'BEGIN{ if (c=="") c=0; printf "%.2f", c }')

RESET="\033[0m"
SEP="\033[38;2;100;100;100m | ${RESET}"

repo_part="\033[1;38;2;230;200;50m${repo_name}${RESET}"

branch_part=""
if [ -n "$branch" ]; then
  branch_part="\033[1;38;2;0;215;215m🌿(${branch})${RESET}"
fi

bar_part="\033[38;2;${fr};${fg};${fb}m${filled_bar}\033[38;2;60;60;60m${empty_bar}${RESET}"

usage_part="${emoji} \033[38;2;${lr};${lg};${lb}m${pct_int}%${RESET}"

cost_part="\033[38;2;230;200;50m\$${cost_fmt}${RESET}"

velocity_part="\033[38;2;0;200;80m+${added}${RESET} \033[38;2;220;40;20m-${removed}${RESET}"

model_part="\033[38;2;200;80;220m🤖 ${model}${RESET}"

line="${repo_part}"
[ -n "$branch_part" ] && line="${line}${SEP}${branch_part}"
line="${line}${SEP}${bar_part}"
line="${line}${SEP}${usage_part}"
line="${line}${SEP}${cost_part}"
line="${line}${SEP}${velocity_part}"
line="${line}${SEP}${model_part}"

printf "%b\n" "$line"
