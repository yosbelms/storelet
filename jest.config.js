/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [
    'node_modules/(?!p-defer)',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    'node_modules/p-defer/.+\\.js$': 'ts-jest',
  },
}
