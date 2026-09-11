const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Create a temporary directory for mock command stubs.
 */
function createMockDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mock-cmds-'));
}

/**
 * Add a mock command stub to a mock directory.
 *
 * @param {string} mockDir   - Directory created by createMockDir()
 * @param {string} name      - Command name (e.g., 'yq', 'gh', 'docker')
 * @param {object} behavior  - One of:
 *   { stdout: string, exitCode?: number }           - static response
 *   { script: string }                              - raw bash script body
 */
function addMockCommand(mockDir, name, behavior) {
  const scriptPath = path.join(mockDir, name);
  let body;

  if (behavior.script) {
    body = `#!/bin/bash\n${behavior.script}`;
  } else {
    const exit = behavior.exitCode || 0;
    const out = behavior.stdout || '';
    // Use a heredoc to avoid quoting issues with special characters
    body = `#!/bin/bash\ncat <<'MOCK_STDOUT_EOF'\n${out}\nMOCK_STDOUT_EOF\nexit ${exit}`;
  }

  fs.writeFileSync(scriptPath, body, { mode: 0o755 });
  return scriptPath;
}

/**
 * Remove a mock directory and all its contents.
 */
function cleanupMockDir(mockDir) {
  fs.rmSync(mockDir, { recursive: true, force: true });
}

module.exports = { createMockDir, addMockCommand, cleanupMockDir };
