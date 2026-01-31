/**
 * Jest Configuration for Frontend React Component Tests
 * 
 * This config is for testing React components.
 * Use: npm run test:frontend
 */

module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src/components'],
    testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx',
                esModuleInterop: true,
                skipLibCheck: true,
            },
        }],
    },
    moduleNameMapper: {
        // Handle CSS imports (with CSS modules)
        '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
        // Handle CSS imports (without CSS modules)
        '^.+\\.(css|sass|scss)$': 'identity-obj-proxy',
        // Handle image imports
        '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
        // Handle module aliases
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.frontend.ts'],
    testTimeout: 10000,
    verbose: true,
};
