#!/usr/bin/env bash

# pick-issue.sh - Local runner for Claude's pick-issue workflow (selection + data collection)
# Implements safe phases from .claude/commands/pick-issue.md without version bump or code changes

set -euo pipefail

# Colors
BOLD="\033[1m"; DIM="\033[2m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; NC="\033[0m"

# Requirements checks
if ! command -v jq >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: jq is not installed. Please install it first.${NC}" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed. Please install it first.${NC}" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Not authenticated with GitHub. Run 'gh auth login' first.${NC}" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: curl is required to download attachments.${NC}" >&2
  exit 1
fi

# Filtering helper functions (from .claude/commands/pick-issue.md)
get_last_commenter() {
  local issue_num=$1
  gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].user.login' 2>/dev/null || echo "none"
}

get_last_comment_time() {
  local issue_num=$1
  gh api "repos/evb0110/mss-downloader/issues/$issue_num/comments" --jq '.[-1].created_at' 2>/dev/null || echo "none"
}

should_skip_issue() {
  local issue_num=$1
  local last_commenter=$(get_last_commenter "$issue_num")
  if [ "$last_commenter" = "evb0110" ]; then
    echo "true"
  else
    echo "false"
  fi
}

is_recently_addressed() {
  local issue_num=$1
  local last_commenter=$(get_last_commenter "$issue_num")
  local last_comment_time=$(get_last_comment_time "$issue_num")
  if [ "$last_commenter" = "evb0110" ]; then
    if [ "$last_comment_time" != "none" ]; then
      # portable date handling (macOS BSD date doesn't support -d). Use python as fallback
      local comment_epoch
      if command -v python3 >/dev/null 2>&1; then
        comment_epoch=$(python3 - <<PY
import sys, datetime
from datetime import timezone
from dateutil import parser as p
try:
  dt = p.parse("$last_comment_time")
except Exception:
  dt = datetime.datetime.fromisoformat("1970-01-01T00:00:00+00:00")
print(int(dt.timestamp()))
PY
)
      else
        # Fallback crude: mark as old
        comment_epoch=0
      fi
      local current_epoch=$(date +%s)
      local hours_diff=$(( (current_epoch - comment_epoch) / 3600 ))
      if [ ${hours_diff:-9999} -le 48 ]; then
        echo "true"
      else
        echo "false"
      fi
    else
      echo "false"
    fi
  else
    echo "false"
  fi
}

check_for_duplicate_fixes() {
  local issue_num=$1
  echo "🔍 Checking for duplicate fixes of Issue #$issue_num..."
  local should_skip=$(should_skip_issue "$issue_num")
  if [ "$should_skip" = "true" ]; then
    local last_commenter=$(get_last_commenter "$issue_num")
    local comment_time=$(get_last_comment_time "$issue_num")
    local recently_addressed=$(is_recently_addressed "$issue_num")
    echo "🛑 CRITICAL: Issue #$issue_num already addressed by evb0110"
    echo "   Last commenter: $last_commenter"
    echo "   Comment time: $comment_time"
    echo "   Recently addressed: $recently_addressed"
    return 1
  fi
  local RECENT_FIXES
  RECENT_FIXES=$(git --no-pager log --oneline -30 --grep="Issue #$issue_num" 2>/dev/null || true)
  if [ -n "$RECENT_FIXES" ]; then
    echo "⚠️  WARNING: Issue #$issue_num mentioned in recent commits:";
    echo "$RECENT_FIXES"
  else
    echo "✅ No recent fixes found for Issue #$issue_num - safe to proceed"
  fi
  return 0
}

# Args
TARGET_ISSUE=""
if [[ ${1:-} =~ ^[0-9]+$ ]]; then
  TARGET_ISSUE="$1"
else
  echo -e "${YELLOW}Usage:${NC} $0 <issue_number>" >&2
  exit 2
fi

# Workspace
mkdir -p .devkit/ultra-priority

echo "📥 Fetching open issues snapshot..."
gh issue list --state open --json number,title,body,author,comments,createdAt --limit 100 > .devkit/all-open-issues.json

# Duplicate prevention
if ! check_for_duplicate_fixes "$TARGET_ISSUE"; then
  echo -e "${YELLOW}🛑 Stopping due to evb0110 filtering or duplicate detection${NC}"
  exit 0
fi

# Extract full issue data
cat .devkit/all-open-issues.json | jq ".[] | select(.number == $TARGET_ISSUE)" > .devkit/target-issue.json
if [ ! -s .devkit/target-issue.json ]; then
  echo -e "${RED}❌ Could not find issue #$TARGET_ISSUE in open issues.${NC}" >&2
  exit 1
fi

ISSUE_TITLE=$(cat .devkit/target-issue.json | jq -r '.title')
ISSUE_AUTHOR=$(cat .devkit/target-issue.json | jq -r '.author.login // .author // "unknown"')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 ULTRA-PRIORITY MODE (Selection + Data Collection)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Target Issue: #$TARGET_ISSUE - $ISSUE_TITLE (by @$ISSUE_AUTHOR)"

# Create dedicated workspace for this issue
ISSUE_DIR=".devkit/ultra-priority/issue-$TARGET_ISSUE"
mkdir -p "$ISSUE_DIR/logs" "$ISSUE_DIR/attachments" "$ISSUE_DIR/analysis"

# Download comments thread
echo "🧵 Downloading full issue thread..."
if ! gh issue view "$TARGET_ISSUE" --comments > "$ISSUE_DIR/full-thread.txt" 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Could not download comments for issue #$TARGET_ISSUE${NC}"
fi

# Extract and download attachments
echo "📥 Scanning for attachments..."
ATTACHMENT_URLS=$(grep -oE 'https://github\.com/user-attachments/files/[0-9]+/[^ )]+' "$ISSUE_DIR/full-thread.txt" || true)
if [ -n "$ATTACHMENT_URLS" ]; then
  echo "$ATTACHMENT_URLS" | nl -ba
  idx=1
  while IFS= read -r url; do
    [ -z "$url" ] && continue
    fname=$(basename "$url")
    echo "⬇️  Downloading attachment $idx: $fname"
    curl -L -f -o "$ISSUE_DIR/logs/attachment-$idx-$fname" "$url" || echo "⚠️  Failed to download $url"
    idx=$((idx+1))
  done <<< "$ATTACHMENT_URLS"
else
  echo "ℹ️  No attachment URLs found."
fi

# Extract inline error lines
if [ -f "$ISSUE_DIR/full-thread.txt" ]; then
  echo "🔎 Extracting inline error messages..."
  grep -E "(Error|Exception|RangeError|TypeError|Invalid array length)" "$ISSUE_DIR/full-thread.txt" > "$ISSUE_DIR/logs/extracted-errors.txt" || true
fi

echo "✅ Preparation complete. Workspace: $ISSUE_DIR"
echo "   - target-issue.json"
echo "   - full-thread.txt"
echo "   - logs/attachment-*.{txt,log,pdf,...} (if any)"
echo "   - logs/extracted-errors.txt (if any)"

echo ""
echo "Next steps (manual or future automation):"
echo "  • Phase 1: Deep analysis"
echo "  • Phase 2: Solution development"
echo "  • Phase 3: Validation"
echo "  • Phase 4/5: Docs + optional version bump (not run by this script)"

