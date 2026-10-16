const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseGitHubOutput } = require('./github-output');

const SCRIPTS_DIR = path.resolve(
  __dirname,
  '../../.github/actions/deploy-prod/scripts'
);

/**
 * Run a deploy-prod shell script and capture its results.
 *
 * @param {string}   scriptName  - Filename in deploy-prod/scripts/ (e.g., 'extract-staging-info.sh')
 * @param {string[]} args        - Positional arguments
 * @param {object}   options
 * @param {object}   options.env      - Extra environment variables
 * @param {string}   options.mockDir  - Directory with mock command stubs (prepended to PATH)
 * @param {string}   options.cwd      - Working directory for the script
 *
 * @returns {{ stdout: string, stderr: string, exitCode: number, outputs: object }}
 */
function runScript(scriptName, args = [], options = {}) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const outputFile = path.join(
    os.tmpdir(),
    `gh-output-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.writeFileSync(outputFile, '');

  const env = {
    ...process.env,
    GITHUB_OUTPUT: outputFile,
    // Strip host tokens that could leak into tests
    GITHUB_TOKEN: '',
    GH_TOKEN: '',
    ...options.env,
  };

  if (options.mockDir) {
    env.PATH = `${options.mockDir}:${env.PATH}`;
  }

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execFileSync('bash', [scriptPath, ...args], {
      env,
      cwd: options.cwd || os.tmpdir(),
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    exitCode = err.status || 1;
  }

  let outputs = {};
  try {
    const outputContent = fs.readFileSync(outputFile, 'utf8');
    outputs = parseGitHubOutput(outputContent);
  } catch (_) {
    // output file may have been deleted by script
  }

  try {
    fs.unlinkSync(outputFile);
  } catch (_) {
    // already cleaned up
  }

  return { stdout, stderr, exitCode, outputs };
}

module.exports = { runScript, SCRIPTS_DIR };
