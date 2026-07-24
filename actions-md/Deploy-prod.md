     _       ____   _____   ___    ___    _   _           ____     ___     ____   ____
    / \     / ___| |_   _| |_ _|  / _ \  | \ | |         |  _ \   / _ \   / ___| / ___|
   / _ \   | |       | |    | |  | | | | |  \| |  _____  | | | | | | | | | |     \___ \
  / ___ \  | |___    | |    | |  | |_| | | |\  | |_____| | |_| | | |_| | | |___   ___) |
 /_/   \_\  \____|   |_|   |___|  \___/  |_| \_|         |____/   \___/   \____| |____/

## Description

Promotes a staging image to production by creating a PR in a production GitOps repository. Extracts the current staging image, verifies it exists on Docker Hub, collects a changelog of PRs between the old and new versions, and creates a deployment PR with full context.

Consists of a reusable workflow (`cd-deploy-prod.yml`) and a composite action (`deploy-prod`).

## Workflow Inputs

| parameter | description | required | default |
| --- | --- | --- | --- |
| SERVICE_NAME | Service name used for image naming, stack file paths, and PR titles | `true` | |
| REASON | Reason for this production deployment | `true` | |
| DRY_RUN | Verify everything but do not create tag or PR | `false` | `false` |
| BRANCH_PREFIX | Branch prefix for deployment PRs in the prod GitOps repo | `false` | `SERVICE_NAME` |
| GITOPS_STAGING_REPO | GitOps staging repository to read current staging image from | `true` | |
| GITOPS_PROD_REPO | GitOps production repository to create deployment PR in | `true` | |
| STACK_FILE_PATH | Path to stack file in GitOps repos | `false` | `infrastructure/${SERVICE_NAME}.stack.yml` |
| DOCKER_REPOSITORY | Docker repository for image verification | `false` | `signalwire/${SERVICE_NAME}` |
| SOURCE_REPO | Source repository for commit comparison links | `false` | `signalwire/${SERVICE_NAME}` |
| BASE_BRANCH | Base branch in the prod GitOps repo | `false` | `main` |
| RUNNER | Runner to use for the deployment job | `false` | `ubuntu-latest` |
| ACTIONS_REF | Ref of signalwire/actions-template to use | `false` | `main` |
| NOTIFY_SLACK | Send Slack notification on deployment PR creation | `false` | `false` |
| SLACK_CHANNEL | Slack channel for deployment notifications | `false` | |

## Secrets

| secret | description | required |
| --- | --- | --- |
| GITOPS_PAT_STAGING | PAT with read access to the staging GitOps repo | `true` |
| GITOPS_PAT_PROD | PAT with read/write access to the production GitOps repo | `true` |
| DOCKERHUB_USERNAME | Docker Hub username for image verification | `true` |
| DOCKERHUB_TOKEN | Docker Hub token for image verification | `true` |
| SLACK_WEBHOOK_URL | Slack webhook URL for deployment notifications | `false` |

## Outputs

| output | description |
| --- | --- |
| NEW_TAG | The timestamp tag created on the source repo |
| PR_URL | URL of the deployment PR created in the prod GitOps repo |
| STAGING_IMAGE_TAG | The image tag extracted from staging |
| PREVIOUS_MERGED | Whether the previous deployment PR for this service was merged |

## Runs

This workflow is a `workflow_call` reusable workflow backed by a `composite` action.

## Usage

In the consuming repository, create a workflow that calls `cd-deploy-prod.yml`:

```yaml
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for this production deployment'
        required: true
        type: string
      dry_run:
        description: 'Dry run mode'
        required: false
        default: false
        type: boolean

jobs:
  deploy:
    uses: signalwire/actions-template/.github/workflows/cd-deploy-prod.yml@main
    with:
      SERVICE_NAME: 'my-service'
      REASON: ${{ inputs.reason }}
      DRY_RUN: ${{ inputs.dry_run }}
      GITOPS_STAGING_REPO: 'org/gitops-staging'
      GITOPS_PROD_REPO: 'org/gitops-prod'
    secrets:
      GITOPS_PAT_STAGING: ${{ secrets.GITOPS_PAT_STAGING }}
      GITOPS_PAT_PROD: ${{ secrets.GITOPS_PAT_PROD }}
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
      DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
```

### With custom branch prefix and Slack notifications

```yaml
jobs:
  deploy:
    uses: signalwire/actions-template/.github/workflows/cd-deploy-prod.yml@main
    with:
      SERVICE_NAME: 'my-service'
      REASON: ${{ inputs.reason }}
      DRY_RUN: ${{ inputs.dry_run }}
      BRANCH_PREFIX: 'my-svc'
      GITOPS_STAGING_REPO: 'org/gitops-staging'
      GITOPS_PROD_REPO: 'org/gitops-prod'
      NOTIFY_SLACK: true
      SLACK_CHANNEL: '#deployments'
    secrets:
      GITOPS_PAT_STAGING: ${{ secrets.GITOPS_PAT_STAGING }}
      GITOPS_PAT_PROD: ${{ secrets.GITOPS_PAT_PROD }}
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
      DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Assumptions

- Stack files are in docker-compose/stack format with `services.<name>.image` and `GIT_SHA` in environment sections.
- Staging image tags may have a `staging-` prefix which is stripped for production.
- Tag format is ISO 8601 timestamps: `YYYY-MM-DDTHH-MM-SSZ`.
- The source repository checkout must have full git history (`fetch-depth: 0`).
