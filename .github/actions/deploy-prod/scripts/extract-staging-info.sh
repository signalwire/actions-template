#!/bin/bash
# Extract image tag and GIT_SHA from a staging stack file using yq.
#
# Usage: ./extract-staging-info.sh <stack_file_path> <service_name>
#
# Outputs (via GITHUB_OUTPUT):
#   full_image      - Full image reference (e.g., org/my-service:staging-20260129-765-2cb19ef)
#   image_tag       - Raw tag from stack file (e.g., staging-20260129-765-2cb19ef)
#   prod_image_tag  - Production-ready tag with staging- prefix stripped (e.g., 20260129-765-2cb19ef)
#   git_sha         - GIT_SHA value from the stack file environment

set -euo pipefail

STACK_FILE="${1:?Usage: extract-staging-info.sh <stack_file_path> <service_name>}"
SERVICE_NAME="${2:?Usage: extract-staging-info.sh <stack_file_path> <service_name>}"

if [[ ! -f "$STACK_FILE" ]]; then
  echo "::error::Stack file not found: $STACK_FILE"
  exit 1
fi

# Use yq to extract the image for the service.
# Stack files use docker-compose format: services.<name>.image
# We search for any service whose image matches the service name pattern.
FULL_IMAGE=$(yq eval '
  .services[].image | select(contains("'"${SERVICE_NAME}"'"))
' "$STACK_FILE" | head -1)

# Fallback: if yq finds nothing (e.g., image is under a different structure),
# try a targeted grep as last resort.
if [[ -z "$FULL_IMAGE" ]]; then
  FULL_IMAGE=$(grep -E "image:.*${SERVICE_NAME}" "$STACK_FILE" | head -1 | awk '{print $2}' | tr -d '"' | tr -d "'")
fi

if [[ -z "$FULL_IMAGE" ]]; then
  echo "::error::Could not extract image for ${SERVICE_NAME} from $STACK_FILE"
  exit 1
fi

IMAGE_TAG="${FULL_IMAGE##*:}"
PROD_IMAGE_TAG="${IMAGE_TAG#staging-}"

# Extract GIT_SHA from the environment section.
# Try yq first for structured parsing.
GIT_SHA=$(yq eval '
  .. | select(has("GIT_SHA")).GIT_SHA
' "$STACK_FILE" 2>/dev/null | head -1)

# Fallback for non-standard formats.
if [[ -z "$GIT_SHA" || "$GIT_SHA" == "null" ]]; then
  GIT_SHA=$(grep -E 'GIT_SHA' "$STACK_FILE" | head -1 | awk -F': ' '{print $NF}' | tr -d ' "' | tr -d "'")
fi

if [[ -z "$GIT_SHA" || "$GIT_SHA" == "null" ]]; then
  echo "::error::Could not extract GIT_SHA from $STACK_FILE"
  exit 1
fi

echo "Staging image: $FULL_IMAGE"
echo "Image tag: $IMAGE_TAG"
echo "Production tag: $PROD_IMAGE_TAG"
echo "GIT_SHA: $GIT_SHA"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "full_image=$FULL_IMAGE"
    echo "image_tag=$IMAGE_TAG"
    echo "prod_image_tag=$PROD_IMAGE_TAG"
    echo "git_sha=$GIT_SHA"
  } >> "$GITHUB_OUTPUT"
fi
