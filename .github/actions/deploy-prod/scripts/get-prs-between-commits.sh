#!/bin/bash
# Get the list of PRs merged between two commits in a source repository.
#
# Usage: ./get-prs-between-commits.sh <old_sha> <new_sha> <source_repo>
# Example: ./get-prs-between-commits.sh abc123 def456 org/my-service
#
# Requires: GH_TOKEN environment variable.
# Must be run from within the source repo checkout (with full git history).
#
# Outputs (via GITHUB_OUTPUT):
#   pr_list - Markdown-formatted list of PRs between the two commits.

set -euo pipefail

OLD_SHA="${1:?Usage: get-prs-between-commits.sh <old_sha> <new_sha> <source_repo>}"
NEW_SHA="${2:?Usage: get-prs-between-commits.sh <old_sha> <new_sha> <source_repo>}"
SOURCE_REPO="${3:?Usage: get-prs-between-commits.sh <old_sha> <new_sha> <source_repo>}"

echo "Finding PRs between $OLD_SHA and $NEW_SHA in $SOURCE_REPO"

PR_LINES=""
TOTAL_COMMITS=""

# Try using the GitHub compare API first (works regardless of local git history depth).
# Cache the full response to avoid duplicate API calls.
COMPARE_JSON=$(gh api "repos/${SOURCE_REPO}/compare/${OLD_SHA}...${NEW_SHA}" 2>/dev/null || echo "")

if [[ -n "$COMPARE_JSON" ]]; then
  TOTAL_COMMITS=$(echo "$COMPARE_JSON" | jq -r '.total_commits // 0')

  # Filter to merge commits only (commits with >1 parent) to avoid picking up
  # issue references and other #NNN patterns from non-merge commit messages.
  MERGE_MESSAGES=$(echo "$COMPARE_JSON" \
    | jq -r '[.commits[] | select(.parents | length > 1)] | .[].commit.message' 2>/dev/null || echo "")

  if [[ -n "$MERGE_MESSAGES" ]]; then
    PR_NUMBERS=$(echo "$MERGE_MESSAGES" | grep -oE '#[0-9]+' | tr -d '#' | sort -un || echo "")
  else
    PR_NUMBERS=""
  fi
else
  # Fallback: use local git history if the API call fails.
  echo "GitHub compare API unavailable, falling back to local git history"
  MERGE_COMMITS=$(git log --oneline --merges "${OLD_SHA}..${NEW_SHA}" 2>/dev/null | head -50 || echo "")
  PR_NUMBERS=$(echo "$MERGE_COMMITS" | grep -oE '#[0-9]+' | tr -d '#' | sort -un || echo "")
fi

# Fetch PR details for each found PR number.
for PR_NUM in $PR_NUMBERS; do
  PR_INFO=$(gh pr view "$PR_NUM" --repo "$SOURCE_REPO" --json number,title 2>/dev/null || echo "")
  if [[ -n "$PR_INFO" ]]; then
    PR_TITLE=$(echo "$PR_INFO" | jq -r '.title')
    PR_LINES="${PR_LINES}- [#${PR_NUM}](https://github.com/${SOURCE_REPO}/pull/${PR_NUM}) - ${PR_TITLE}
"
  fi
done

# If no PRs were found, provide a commit count summary.
if [[ -z "$PR_LINES" ]]; then
  if [[ -z "$TOTAL_COMMITS" ]]; then
    TOTAL_COMMITS=$(git rev-list --count "${OLD_SHA}..${NEW_SHA}" 2>/dev/null || echo "0")
  fi

  if [[ "$TOTAL_COMMITS" -gt 0 ]] 2>/dev/null; then
    PR_LINES="*${TOTAL_COMMITS} commits between versions (see comparison link above for details)*"
  else
    PR_LINES="*No commits found between versions*"
  fi
fi

echo "Found PRs:"
echo "$PR_LINES"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "pr_list<<DEPLOY_PROD_PR_LIST_EOF"
    echo "$PR_LINES"
    echo "DEPLOY_PROD_PR_LIST_EOF"
  } >> "$GITHUB_OUTPUT"
fi
