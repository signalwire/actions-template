const { runScript } = require('../helpers/run-script');
const { createMockDir, addMockCommand, cleanupMockDir } = require('../helpers/mock-commands');

describe('get-prs-between-commits.sh', () => {
  let mockDir;

  beforeEach(() => {
    mockDir = createMockDir();
  });

  afterEach(() => {
    cleanupMockDir(mockDir);
  });

  describe('argument validation', () => {
    it('exits with error when fewer than 3 arguments provided', () => {
      addMockCommand(mockDir, 'gh', { stdout: '', exitCode: 0 });
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });
      const result = runScript('get-prs-between-commits.sh', ['abc123'], { mockDir });
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('GitHub compare API path', () => {
    it('extracts PR numbers from merge commits and fetches titles', () => {
      const compareResponse = JSON.stringify({
        total_commits: 3,
        commits: [
          {
            commit: { message: 'Merge pull request #101 from feature-a' },
            parents: [{ sha: 'a' }, { sha: 'b' }],
          },
          {
            commit: { message: 'fix: a regular commit referencing #999' },
            parents: [{ sha: 'c' }],
          },
          {
            commit: { message: 'Merge pull request #102 from feature-b' },
            parents: [{ sha: 'd' }, { sha: 'e' }],
          },
        ],
      });

      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  cat <<'EOF'
${compareResponse}
EOF
elif [[ "$1" == "pr" && "$2" == "view" ]]; then
  PR_NUM="$3"
  if [[ "$PR_NUM" == "101" ]]; then
    echo '{"number": 101, "title": "Add feature A"}'
  elif [[ "$PR_NUM" == "102" ]]; then
    echo '{"number": 102, "title": "Fix bug B"}'
  fi
fi
`,
      });
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_list).toContain('#101');
      expect(result.outputs.pr_list).toContain('Add feature A');
      expect(result.outputs.pr_list).toContain('#102');
      expect(result.outputs.pr_list).toContain('Fix bug B');
    });

    it('ignores non-merge commits (single parent)', () => {
      const compareResponse = JSON.stringify({
        total_commits: 2,
        commits: [
          {
            commit: { message: 'fix: commit mentioning #999' },
            parents: [{ sha: 'a' }],
          },
          {
            commit: { message: 'Merge pull request #101 from feature-a' },
            parents: [{ sha: 'b' }, { sha: 'c' }],
          },
        ],
      });

      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  cat <<'EOF'
${compareResponse}
EOF
elif [[ "$1" == "pr" && "$2" == "view" ]]; then
  echo '{"number": 101, "title": "Feature A"}'
fi
`,
      });
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      // PR #999 should NOT appear (single-parent commit)
      expect(result.outputs.pr_list).not.toContain('#999');
      // PR #101 should appear (merge commit)
      expect(result.outputs.pr_list).toContain('#101');
    });
  });

  describe('git log fallback', () => {
    it('falls back to local git log when gh api fails', () => {
      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  exit 1
elif [[ "$1" == "pr" && "$2" == "view" ]]; then
  echo '{"number": 55, "title": "Some PR"}'
fi
`,
      });
      addMockCommand(mockDir, 'git', {
        script: `
if [[ "$1" == "log" ]]; then
  echo "abc1234 Merge pull request #55 from branch"
elif [[ "$1" == "rev-list" ]]; then
  echo "5"
fi
`,
      });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_list).toContain('#55');
      expect(result.outputs.pr_list).toContain('Some PR');
    });
  });

  describe('no PRs found', () => {
    it('outputs commit count summary when commits exist but no PRs', () => {
      const compareResponse = JSON.stringify({
        total_commits: 5,
        commits: [
          {
            commit: { message: 'chore: update deps' },
            parents: [{ sha: 'a' }],
          },
        ],
      });

      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  cat <<'EOF'
${compareResponse}
EOF
fi
`,
      });
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_list).toContain('5 commits');
    });

    it('reports no commits when compare returns 0', () => {
      const compareResponse = JSON.stringify({
        total_commits: 0,
        commits: [],
      });

      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  cat <<'EOF'
${compareResponse}
EOF
fi
`,
      });
      addMockCommand(mockDir, 'git', {
        script: `
if [[ "$1" == "rev-list" ]]; then
  echo "0"
fi
`,
      });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.pr_list).toContain('No commits found');
    });
  });

  describe('GITHUB_OUTPUT multiline format', () => {
    it('uses heredoc delimiter for pr_list output', () => {
      addMockCommand(mockDir, 'gh', {
        script: `
if [[ "$1" == "api" ]]; then
  echo '{"total_commits": 1, "commits": [{"commit": {"message": "Merge pull request #10 from x"}, "parents": [{"sha":"a"},{"sha":"b"}]}]}'
elif [[ "$1" == "pr" && "$2" == "view" ]]; then
  echo '{"number": 10, "title": "Test PR"}'
fi
`,
      });
      addMockCommand(mockDir, 'git', { stdout: '', exitCode: 0 });

      const result = runScript(
        'get-prs-between-commits.sh',
        ['abc123', 'def456', 'acme-org/my-service'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      // The output should contain a markdown link
      expect(result.outputs.pr_list).toMatch(
        /\[#10\]\(https:\/\/github\.com\/acme-org\/my-service\/pull\/10\)/
      );
      expect(result.outputs.pr_list).toContain('Test PR');
    });
  });
});
