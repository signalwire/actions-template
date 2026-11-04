const fs = require('fs');
const os = require('os');
const path = require('path');
const { runScript } = require('../helpers/run-script');
const { createMockDir, addMockCommand, cleanupMockDir } = require('../helpers/mock-commands');

const FIXTURES = path.resolve(__dirname, '../fixtures');

// Standard set of required args for create-prod-pr.sh
function baseArgs(overrides = {}) {
  const defaults = {
    '--service-name': 'my-service',
    '--branch-name': 'my-service/2026-02-13T10-30-00Z',
    '--new-image-tag': '20260213-900-newsha12',
    '--new-sha': 'newsha1234567890abcdef1234567890abcdef12',
    '--old-image-tag': '20260115-700-oldsha12',
    '--old-sha': 'oldsha1234567890abcdef1234567890abcdef12',
    '--repo': 'acme-org/gitops-prod',
    '--source-repo': 'acme-org/my-service',
    '--stack-file': 'infrastructure/my-service.stack.yml',
    '--docker-repo': 'acme-org/my-service',
  };

  const merged = { ...defaults, ...overrides };
  const args = [];
  for (const [flag, value] of Object.entries(merged)) {
    if (value === null) continue; // allow removing args
    args.push(flag, value);
  }
  return args;
}

function baseEnv() {
  return {
    DEPLOY_REASON: 'Scheduled weekly release',
    PR_LIST: '- [#101](https://github.com/acme-org/my-service/pull/101) - Add feature A',
  };
}

describe('create-prod-pr.sh', () => {
  let mockDir;

  beforeEach(() => {
    mockDir = createMockDir();
  });

  afterEach(() => {
    cleanupMockDir(mockDir);
  });

  describe('argument parsing', () => {
    it('exits with error on unknown flag', () => {
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });
      const result = runScript(
        'create-prod-pr.sh',
        ['--unknown-flag', 'value'],
        { mockDir, env: baseEnv() }
      );
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('::error::');
      expect(result.stdout).toContain('Unknown option');
    });

    it('exits with error when required --service-name is missing', () => {
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });
      const args = baseArgs({ '--service-name': null });
      // Remove the flag entirely
      const filtered = [];
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] !== '--service-name') {
          filtered.push(args[i], args[i + 1]);
        }
      }
      const result = runScript('create-prod-pr.sh', filtered, {
        mockDir,
        env: baseEnv(),
      });
      expect(result.exitCode).not.toBe(0);
    });

    it('exits with error when DEPLOY_REASON env var is missing', () => {
      addMockCommand(mockDir, 'git', {
        script: 'if [[ "$1" == "ls-remote" ]]; then exit 2; fi',
      });
      const result = runScript('create-prod-pr.sh', baseArgs(), {
        mockDir,
        env: { DEPLOY_REASON: '', PR_LIST: 'some list' },
      });
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('branch existence check', () => {
    it('exits 1 when branch already exists on remote', () => {
      addMockCommand(mockDir, 'git', {
        script: `
if [[ "$1" == "ls-remote" ]]; then
  echo "abc123	refs/heads/my-service/2026-02-13T10-30-00Z"
  exit 0
fi
`,
      });

      const result = runScript('create-prod-pr.sh', baseArgs(), {
        mockDir,
        env: baseEnv(),
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('::error::');
      expect(result.stdout).toContain('already exists');
    });
  });

  describe('dry-run mode', () => {
    beforeEach(() => {
      // git ls-remote returns non-zero (branch doesn't exist)
      addMockCommand(mockDir, 'git', {
        script: 'if [[ "$1" == "ls-remote" ]]; then exit 2; fi',
      });
    });

    it('does not call git checkout, commit, push, or gh pr create', () => {
      const callLog = path.join(mockDir, 'calls.log');
      fs.writeFileSync(callLog, '');

      addMockCommand(mockDir, 'gh', {
        script: `echo "gh $*" >> "${callLog}"; exit 0`,
      });

      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: baseEnv() }
      );

      expect(result.exitCode).toBe(0);

      const calls = fs.readFileSync(callLog, 'utf8');
      expect(calls).not.toContain('gh pr create');
    });

    it('prints planned actions to stdout', () => {
      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: baseEnv() }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('DRY RUN');
      expect(result.stdout).toContain('Would create branch');
      expect(result.stdout).toContain('Would update file');
    });

    it('sets pr_url=DRY_RUN_NO_PR_CREATED in GITHUB_OUTPUT', () => {
      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: baseEnv() }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_url).toBe('DRY_RUN_NO_PR_CREATED');
    });

    it('displays the full PR body in stdout', () => {
      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: baseEnv() }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Production Deployment: my-service');
      expect(result.stdout).toContain('acme-org/my-service:20260213-900-newsha12');
      expect(result.stdout).toContain('acme-org/my-service:20260115-700-oldsha12');
      expect(result.stdout).toContain('Scheduled weekly release');
      expect(result.stdout).toContain('#101');
    });
  });

  describe('PR body content', () => {
    it('contains all expected sections', () => {
      addMockCommand(mockDir, 'git', {
        script: 'if [[ "$1" == "ls-remote" ]]; then exit 2; fi',
      });

      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: baseEnv() }
      );

      expect(result.exitCode).toBe(0);
      const output = result.stdout;

      // Image table
      expect(output).toContain('**New**');
      expect(output).toContain('**Previous**');
      expect(output).toContain('newsha1234567890abcdef1234567890abcdef12');
      expect(output).toContain('oldsha1234567890abcdef1234567890abcdef12');

      // Reason
      expect(output).toContain('Reason for Deploy');
      expect(output).toContain('Scheduled weekly release');

      // Comparison link
      expect(output).toContain('Full Commit Comparison');
      expect(output).toContain(
        'acme-org/my-service/compare/oldsha1234567890abcdef1234567890abcdef12...newsha1234567890abcdef1234567890abcdef12'
      );

      // PR list
      expect(output).toContain('Pull Requests Included');

      // Checklist
      expect(output).toContain('Pre-Merge Checklist');
      expect(output).toContain('Verified the Docker image');
    });

    it('uses fallback message when PR_LIST is empty', () => {
      addMockCommand(mockDir, 'git', {
        script: 'if [[ "$1" == "ls-remote" ]]; then exit 2; fi',
      });

      const result = runScript(
        'create-prod-pr.sh',
        [...baseArgs(), '--dry-run'],
        { mockDir, env: { DEPLOY_REASON: 'Test', PR_LIST: '' } }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No PRs found between versions');
    });
  });

  describe('normal mode (non-dry-run)', () => {
    it('creates branch, commits, pushes, and creates PR', () => {
      const callLog = path.join(mockDir, 'calls.log');
      fs.writeFileSync(callLog, '');

      addMockCommand(mockDir, 'git', {
        script: `
echo "git $*" >> "${callLog}"
if [[ "$1" == "ls-remote" ]]; then
  exit 2
fi
`,
      });
      addMockCommand(mockDir, 'yq', {
        script: `echo "yq $*" >> "${callLog}"`,
      });
      addMockCommand(mockDir, 'gh', {
        script: `
echo "gh $*" >> "${callLog}"
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  echo "https://github.com/acme-org/gitops-prod/pull/99"
fi
`,
      });

      const result = runScript('create-prod-pr.sh', baseArgs(), {
        mockDir,
        env: baseEnv(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_url).toBe(
        'https://github.com/acme-org/gitops-prod/pull/99'
      );

      const calls = fs.readFileSync(callLog, 'utf8');
      expect(calls).toContain('git checkout -b');
      expect(calls).toContain('git add');
      expect(calls).toContain('git commit');
      expect(calls).toContain('git push origin');
      expect(calls).toContain('gh pr create');
    });

    it('sets correct PR title format', () => {
      const callLog = path.join(mockDir, 'calls.log');
      fs.writeFileSync(callLog, '');

      addMockCommand(mockDir, 'git', {
        script: `
echo "git $*" >> "${callLog}"
if [[ "$1" == "ls-remote" ]]; then exit 2; fi
`,
      });
      addMockCommand(mockDir, 'yq', {
        script: `echo "yq $*" >> "${callLog}"`,
      });
      addMockCommand(mockDir, 'gh', {
        script: `
echo "gh $*" >> "${callLog}"
if [[ "$1" == "pr" && "$2" == "create" ]]; then
  echo "https://github.com/acme-org/gitops-prod/pull/99"
fi
`,
      });

      runScript('create-prod-pr.sh', baseArgs(), {
        mockDir,
        env: baseEnv(),
      });

      const calls = fs.readFileSync(callLog, 'utf8');
      expect(calls).toContain(
        '[my-service] Update image to acme-org/my-service:20260213-900-newsha12'
      );
    });
  });
});
