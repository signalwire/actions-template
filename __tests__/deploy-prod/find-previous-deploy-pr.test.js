const { runScript } = require('../helpers/run-script');
const { createMockDir, addMockCommand, cleanupMockDir } = require('../helpers/mock-commands');

describe('find-previous-deploy-pr.sh', () => {
  let mockDir;

  beforeEach(() => {
    mockDir = createMockDir();
  });

  afterEach(() => {
    cleanupMockDir(mockDir);
  });

  describe('argument validation', () => {
    it('exits with error when no arguments provided', () => {
      addMockCommand(mockDir, 'gh', { stdout: '[]', exitCode: 0 });
      const result = runScript('find-previous-deploy-pr.sh', [], { mockDir });
      expect(result.exitCode).not.toBe(0);
    });

    it('exits with error when only repo provided', () => {
      addMockCommand(mockDir, 'gh', { stdout: '[]', exitCode: 0 });
      const result = runScript('find-previous-deploy-pr.sh', ['acme-org/gitops-prod'], {
        mockDir,
      });
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('no previous PRs found', () => {
    it('exits 0 with previous_merged=unknown when gh returns empty array', () => {
      addMockCommand(mockDir, 'gh', { stdout: '[]', exitCode: 0 });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service/'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.previous_merged).toBe('unknown');
    });

    it('exits 0 when no PRs match the branch prefix', () => {
      addMockCommand(mockDir, 'gh', {
        stdout: JSON.stringify([
          {
            number: 10,
            headRefName: 'other-service/2026-01-01',
            state: 'MERGED',
            mergedAt: '2026-01-01T00:00:00Z',
            title: 'Deploy other-service',
          },
        ]),
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.previous_merged).toBe('unknown');
    });
  });

  describe('previous PR was merged', () => {
    it('sets previous_merged=true and outputs PR details', () => {
      addMockCommand(mockDir, 'gh', {
        stdout: JSON.stringify([
          {
            number: 42,
            headRefName: 'my-service/2026-01-28T10-30-00Z',
            state: 'MERGED',
            mergedAt: '2026-01-28T12:00:00Z',
            title: '[my-service] Update image',
          },
          {
            number: 40,
            headRefName: 'my-service/2026-01-20T08-00-00Z',
            state: 'MERGED',
            mergedAt: '2026-01-20T10:00:00Z',
            title: '[my-service] Update image',
          },
        ]),
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.previous_merged).toBe('true');
      expect(result.outputs.last_pr_number).toBe('42');
      expect(result.outputs.last_pr_state).toBe('MERGED');
      expect(result.outputs.last_pr_branch).toBe('my-service/2026-01-28T10-30-00Z');
    });

    it('selects the highest-numbered PR matching the prefix', () => {
      addMockCommand(mockDir, 'gh', {
        stdout: JSON.stringify([
          {
            number: 30,
            headRefName: 'my-service/2026-01-10',
            state: 'MERGED',
            mergedAt: '2026-01-10T00:00:00Z',
            title: 'Old deploy',
          },
          {
            number: 50,
            headRefName: 'my-service/2026-02-01',
            state: 'MERGED',
            mergedAt: '2026-02-01T00:00:00Z',
            title: 'New deploy',
          },
        ]),
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.last_pr_number).toBe('50');
    });
  });

  describe('previous PR was not merged', () => {
    it('sets previous_merged=false and finds last merged PR', () => {
      addMockCommand(mockDir, 'gh', {
        stdout: JSON.stringify([
          {
            number: 45,
            headRefName: 'my-service/2026-02-01',
            state: 'OPEN',
            mergedAt: null,
            title: 'Pending deploy',
          },
          {
            number: 42,
            headRefName: 'my-service/2026-01-28',
            state: 'MERGED',
            mergedAt: '2026-01-28T12:00:00Z',
            title: 'Last merged deploy',
          },
        ]),
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.previous_merged).toBe('false');
      expect(result.outputs.last_pr_number).toBe('45');
      expect(result.outputs.last_pr_state).toBe('OPEN');
      expect(result.outputs.last_merged_pr_number).toBe('42');
    });

    it('handles CLOSED PR without any merged PRs', () => {
      addMockCommand(mockDir, 'gh', {
        stdout: JSON.stringify([
          {
            number: 45,
            headRefName: 'my-service/2026-02-01',
            state: 'CLOSED',
            mergedAt: null,
            title: 'Closed deploy',
          },
        ]),
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.previous_merged).toBe('false');
      expect(result.outputs.last_pr_number).toBe('45');
      expect(result.outputs).not.toHaveProperty('last_merged_pr_number');
    });
  });

  describe('gh CLI failure', () => {
    it('exits 1 when gh pr list fails', () => {
      addMockCommand(mockDir, 'gh', {
        script: 'echo "HTTP 401: Bad credentials" >&2; exit 1',
      });

      const result = runScript(
        'find-previous-deploy-pr.sh',
        ['acme-org/gitops-prod', 'my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(1);
    });
  });
});
