#!/bin/bash
# Verify a Docker image exists without pulling it.
#
# Usage: ./verify-docker-image.sh <repository> <tag>
# Example: ./verify-docker-image.sh org/my-service 20260129-765-2cb19ef
#
# Requires: Docker login for private repositories (use docker/login-action in workflow).

set -euo pipefail

REPOSITORY="${1:?Usage: verify-docker-image.sh <repository> <tag>}"
TAG="${2:?Usage: verify-docker-image.sh <repository> <tag>}"

echo "Verifying image ${REPOSITORY}:${TAG} exists..."

# Try docker manifest inspect first (works for private repos when authenticated).
if docker manifest inspect "${REPOSITORY}:${TAG}" > /dev/null 2>&1; then
  echo "Docker image ${REPOSITORY}:${TAG} verified via manifest inspect"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "image_exists=true" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

# Fallback: Docker Hub API (works for public repos without auth).
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://hub.docker.com/v2/repositories/${REPOSITORY}/tags/${TAG}" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "Docker image ${REPOSITORY}:${TAG} verified via Docker Hub API"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "image_exists=true" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

echo "::error::Docker image ${REPOSITORY}:${TAG} not found"
echo "  - docker manifest inspect: failed (not logged in or image does not exist)"
echo "  - Docker Hub API: HTTP $HTTP_STATUS"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "image_exists=false" >> "$GITHUB_OUTPUT"
fi
exit 1
