/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  // The generated Prisma client imports "./x.js"; map relative .js imports back to the .ts sources.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 60000,
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/seed/**'],
};
