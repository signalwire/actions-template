#!/bin/bash
# Find previous deployment PRs for a service in a GitOps repo.
#
# Usage: ./find-previous-deploy-pr.sh <gitops_repo> <branch_prefix>
# Example: ./find-previous-deploy-pr.sh org/gitops-prod my-service/
#
# Requires: GH_TOKEN environment variable with repo read access.
#
# Outputs (via GITHUB_OUTPUT):
#   last_pr_number      - Number of the most recent deployment PR
#   last_pr_state       - State of that PR (OPEN, CLOSED, MERGED)
#   last_pr_branch      - Head branch of that PR
#   previous_merged     - "true" if last PR was merged, "false" if not, "unknown" if none found
#   last_merged_pr_number - Number of the last actually merged PR (if the latest wasn't merged)

set -euo pipefail

REPO="${1:?Usage: find-previous-deploy-pr.sh <gitops_repo> <branch_prefix>}"
BRANCH_PREFIX="${2:?Usage: find-previous-deploy-pr.sh <gitops_repo> <branch_prefix>}"

# Ensure trailing slash on prefix for consistent matching.
BRANCH_PREFIX="${BRANCH_PREFIX%/}/"

echo "Searching for previous ${BRANCH_PREFIX}* PRs in $REPO..."

# Query PRs using the service name as a broad search term.
# The jq filter below does precise matching on headRefName, so
# the search just needs to return a superset that includes our PRs.
# gh returns non-zero on auth failures - fail fast in that case.
SEARCH_TERM="${BRANCH_PREFIX%/}"
PREVIOUS_PRS=$(gh pr list \
  --repo "$REPO" \
  --state all \
  --limit 50 \
  --search "$SEARCH_TERM" \
  --json number,headRefName,state,mergedAt,title 2>&1) || {
    echo "::error::Failed to query PRs from $REPO. Check GH_TOKEN permissions."
    echo "gh output: $PREVIOUS_PRS"
    exit 1
  }

# Sort by PR number descending and find the most recent one matching the branch prefix.
LAST_PR=$(echo "$PREVIOUS_PRS" \
  | jq -r "[.[] | select(.headRefName | startswith(\"$BRANCH_PREFIX\"))] | sort_by(.number) | reverse | first")

if [[ "$LAST_PR" == "null" || -z "$LAST_PR" ]]; then
  echo "No previous ${BRANCH_PREFIX}* PRs found (this may be the first automated deployment)"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "previous_merged=unknown" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

LAST_PR_NUMBER=$(echo "$LAST_PR" | jq -r '.number')
LAST_PR_STATE=$(echo "$LAST_PR" | jq -r '.state')
LAST_PR_BRANCH=$(echo "$LAST_PR" | jq -r '.headRefName')
LAST_PR_MERGED_AT=$(echo "$LAST_PR" | jq -r '.mergedAt')

echo "Most recent PR: #$LAST_PR_NUMBER ($LAST_PR_BRANCH) - state: $LAST_PR_STATE"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "last_pr_number=$LAST_PR_NUMBER"
    echo "last_pr_state=$LAST_PR_STATE"
    echo "last_pr_branch=$LAST_PR_BRANCH"
  } >> "$GITHUB_OUTPUT"
fi

if [[ "$LAST_PR_STATE" == "MERGED" ]]; then
  echo "Previous PR #$LAST_PR_NUMBER was merged on $LAST_PR_MERGED_AT"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "previous_merged=true" >> "$GITHUB_OUTPUT"
  fi
else
  echo "::warning::Previous PR #$LAST_PR_NUMBER ($LAST_PR_BRANCH) was NOT merged (state: $LAST_PR_STATE)"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "previous_merged=false" >> "$GITHUB_OUTPUT"
  fi

  # Find the last actually merged PR for context.
  LAST_MERGED=$(echo "$PREVIOUS_PRS" \
    | jq -r "[.[] | select(.headRefName | startswith(\"$BRANCH_PREFIX\")) | select(.state == \"MERGED\")] | sort_by(.number) | reverse | first")

  if [[ "$LAST_MERGED" != "null" && -n "$LAST_MERGED" ]]; then
    LAST_MERGED_NUMBER=$(echo "$LAST_MERGED" | jq -r '.number')
    LAST_MERGED_BRANCH=$(echo "$LAST_MERGED" | jq -r '.headRefName')
    echo "::warning::Last actually merged PR was #$LAST_MERGED_NUMBER ($LAST_MERGED_BRANCH)"
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      {
        echo "last_merged_pr_number=$LAST_MERGED_NUMBER"
        echo "last_merged_pr_branch=$LAST_MERGED_BRANCH"
      } >> "$GITHUB_OUTPUT"
    fi
  fi
fi
