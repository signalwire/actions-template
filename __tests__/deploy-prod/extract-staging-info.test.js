const path = require('path');
const { execFileSync } = require('child_process');
const { runScript } = require('../helpers/run-script');
const { createMockDir, addMockCommand, cleanupMockDir } = require('../helpers/mock-commands');

const FIXTURES = path.resolve(__dirname, '../fixtures');

// Detect yq availability for tests that need real YAML parsing
let hasYq = false;
try {
  execFileSync('yq', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  hasYq = true;
} catch (_) {}

const describeWithYq = hasYq ? describe : describe.skip;

describe('extract-staging-info.sh', () => {
  describe('argument validation', () => {
    it('exits with error when no arguments provided', () => {
      const result = runScript('extract-staging-info.sh');
      expect(result.exitCode).not.toBe(0);
    });

    it('exits with error when only stack file path provided', () => {
      const result = runScript('extract-staging-info.sh', ['/tmp/some-file.yml']);
      expect(result.exitCode).not.toBe(0);
    });

    it('exits with error when stack file does not exist', () => {
      const result = runScript('extract-staging-info.sh', [
        '/tmp/nonexistent-stack-file.yml',
        'my-service',
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('::error::');
      expect(result.stdout).toContain('not found');
    });
  });

  describeWithYq('yq-based extraction (primary path)', () => {
    it('extracts full image, tag, prod tag, and git SHA from standard stack file', () => {
      const fixture = path.join(FIXTURES, 'staging-stack.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      expect(result.exitCode).toBe(0);
      expect(result.outputs.full_image).toBe(
        'acme-org/my-service:staging-20260129-765-2cb19ef'
      );
      expect(result.outputs.image_tag).toBe('staging-20260129-765-2cb19ef');
      expect(result.outputs.prod_image_tag).toBe('20260129-765-2cb19ef');
      expect(result.outputs.git_sha).toBe(
        '2cb19efabc123456789012345678901234567890'
      );
    });

    it('strips staging- prefix to produce prod_image_tag', () => {
      const fixture = path.join(FIXTURES, 'staging-stack.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      expect(result.exitCode).toBe(0);
      // prod_image_tag should NOT start with "staging-"
      expect(result.outputs.prod_image_tag).not.toMatch(/^staging-/);
      // but image_tag should
      expect(result.outputs.image_tag).toMatch(/^staging-/);
    });

    it('writes all four outputs to GITHUB_OUTPUT', () => {
      const fixture = path.join(FIXTURES, 'staging-stack.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      expect(result.exitCode).toBe(0);
      expect(result.outputs).toHaveProperty('full_image');
      expect(result.outputs).toHaveProperty('image_tag');
      expect(result.outputs).toHaveProperty('prod_image_tag');
      expect(result.outputs).toHaveProperty('git_sha');
    });

    it('prints human-readable summary to stdout', () => {
      const fixture = path.join(FIXTURES, 'staging-stack.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Staging image:');
      expect(result.stdout).toContain('Image tag:');
      expect(result.stdout).toContain('Production tag:');
      expect(result.stdout).toContain('GIT_SHA:');
    });
  });

  describeWithYq('error cases', () => {
    it('exits non-zero when image cannot be found for the service', () => {
      const fixture = path.join(FIXTURES, 'staging-stack-no-image.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      // Script fails either via set -euo pipefail (grep no match) or explicit exit 1
      expect(result.exitCode).not.toBe(0);
      // Should NOT produce any successful output keys
      expect(result.outputs).not.toHaveProperty('prod_image_tag');
    });

    it('exits non-zero when GIT_SHA is missing from stack file', () => {
      const fixture = path.join(FIXTURES, 'staging-stack-no-sha.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service']);

      // Script fails either via set -euo pipefail or explicit exit 1
      expect(result.exitCode).not.toBe(0);
      // Should NOT produce a git_sha output
      expect(result.outputs).not.toHaveProperty('git_sha');
    });
  });

  describe('grep fallback path', () => {
    let mockDir;

    beforeEach(() => {
      mockDir = createMockDir();
      // Mock yq to return empty for image queries but succeed for GIT_SHA
      addMockCommand(mockDir, 'yq', {
        script: `
# Return empty for image queries, return SHA for GIT_SHA queries
if echo "$@" | grep -q "GIT_SHA"; then
  echo "2cb19efabc123456789012345678901234567890"
else
  echo ""
fi
`,
      });
    });

    afterEach(() => {
      cleanupMockDir(mockDir);
    });

    it('falls back to grep when yq finds no matching image', () => {
      const fixture = path.join(FIXTURES, 'staging-stack.yml');
      const result = runScript('extract-staging-info.sh', [fixture, 'my-service'], {
        mockDir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.outputs.full_image).toBe(
        'acme-org/my-service:staging-20260129-765-2cb19ef'
      );
    });
  });
});
