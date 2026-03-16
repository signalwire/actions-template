module.exports = {
  testMatch: [
    '**/*.test.js',
  ],
  reporters: [
    'default',
    [ 'jest-junit', {
      outputDirectory: 'reports',
      outputName: 'jest-junit.xml',
    } ]
  ],
  testTimeout: 15000,
};