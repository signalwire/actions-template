/**
 * Parse a GITHUB_OUTPUT file into a key-value map.
 *
 * Supports two formats:
 *   - Simple:    key=value
 *   - Multiline: key<<DELIMITER\n...lines...\nDELIMITER
 */
function parseGitHubOutput(content) {
  const outputs = {};
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Multiline heredoc format: key<<DELIMITER
    const heredocMatch = line.match(/^([^=]+)<<(.+)$/);
    if (heredocMatch) {
      const key = heredocMatch[1];
      const delimiter = heredocMatch[2];
      const valueLines = [];
      i++;
      while (i < lines.length && lines[i] !== delimiter) {
        valueLines.push(lines[i]);
        i++;
      }
      outputs[key] = valueLines.join('\n');
      i++; // skip delimiter line
      continue;
    }

    // Simple format: key=value
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex);
      const value = line.substring(eqIndex + 1);
      outputs[key] = value;
    }
    i++;
  }

  return outputs;
}

module.exports = { parseGitHubOutput };
