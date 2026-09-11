const { runScript } = require('../helpers/run-script');
const { createMockDir, addMockCommand, cleanupMockDir } = require('../helpers/mock-commands');

describe('verify-docker-image.sh', () => {
  let mockDir;

  beforeEach(() => {
    mockDir = createMockDir();
  });

  afterEach(() => {
    cleanupMockDir(mockDir);
  });

  describe('argument validation', () => {
    it('exits with error when no arguments provided', () => {
      const result = runScript('verify-docker-image.sh', [], { mockDir });
      expect(result.exitCode).not.toBe(0);
    });

    it('exits with error when only repository provided', () => {
      const result = runScript('verify-docker-image.sh', ['acme-org/my-service'], {
        mockDir,
      });
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('docker manifest inspect succeeds', () => {
    beforeEach(() => {
      addMockCommand(mockDir, 'docker', {
        script: 'if [[ "$1" == "manifest" && "$2" == "inspect" ]]; then echo "{}"; exit 0; fi; exit 1',
      });
    });

    it('exits 0 and sets image_exists=true', () => {
      const result = runScript(
        'verify-docker-image.sh',
        ['acme-org/my-service', '20260129-765-2cb19ef'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.image_exists).toBe('true');
      expect(result.stdout).toContain('verified via manifest inspect');
    });
  });

  describe('Docker Hub API fallback', () => {
    beforeEach(() => {
      // docker manifest inspect fails
      addMockCommand(mockDir, 'docker', { stdout: '', exitCode: 1 });
    });

    it('exits 0 when API returns 200', () => {
      addMockCommand(mockDir, 'curl', {
        // The script uses: curl -s -o /dev/null -w "%{http_code}" <url>
        // With our mock, curl just outputs the status code
        script: 'echo "200"',
      });

      const result = runScript(
        'verify-docker-image.sh',
        ['acme-org/my-service', '20260129-765-2cb19ef'],
        { mockDir }
      );

      expect(result.exitCode).toBe(0);
      expect(result.outputs.image_exists).toBe('true');
      expect(result.stdout).toContain('verified via Docker Hub API');
    });

    it('exits 1 when API returns 404', () => {
      addMockCommand(mockDir, 'curl', { script: 'echo "404"' });

      const result = runScript(
        'verify-docker-image.sh',
        ['acme-org/my-service', 'nonexistent-tag'],
        { mockDir }
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.image_exists).toBe('false');
      expect(result.stdout).toContain('::error::');
    });
  });

  describe('both methods fail', () => {
    it('exits 1 with error details', () => {
      addMockCommand(mockDir, 'docker', { stdout: '', exitCode: 1 });
      addMockCommand(mockDir, 'curl', { script: 'echo "500"' });

      const result = runScript(
        'verify-docker-image.sh',
        ['acme-org/my-service', 'bad-tag'],
        { mockDir }
      );

      expect(result.exitCode).toBe(1);
      expect(result.outputs.image_exists).toBe('false');
      expect(result.stdout).toContain('::error::');
      expect(result.stdout).toContain('HTTP 500');
    });
  });
});
