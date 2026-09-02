import { createDefaultPreset } from 'ts-jest'

const presetConfig = createDefaultPreset({
  tsconfigPath: 'tsconfig.json',
  compiler: 'typescript',
  diagnostics: true,
})

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Source files use explicit .js extensions on relative imports so the
  // compiled ESM output resolves at runtime. ts-jest transpiles .ts in place,
  // so strip the extension when resolving those imports during tests.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: './coverage',
  reporters: ['default'],
  ...presetConfig,
  restoreMocks: true,
  resetMocks: true,
};