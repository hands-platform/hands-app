/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/lib', '<rootDir>/app', '<rootDir>/components'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  clearMocks: true,
};
