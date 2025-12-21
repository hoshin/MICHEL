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
  coverageDirectory: './coverage',
  reporters: ['default'],
  ...presetConfig,
};