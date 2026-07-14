module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: './coverage',
    reporters: ['default'],
}
