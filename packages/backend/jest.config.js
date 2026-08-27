export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@razor/shared$': '<rootDir>/../shared/src/index.ts',
    '^@razor/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'database.test.ts'],
  // Run tests sequentially to avoid SERIALIZABLE transaction conflicts
  // Multiple Jest workers running in parallel on the same PostgreSQL test database
  // causes serialization failures when OrderService uses SERIALIZABLE isolation level
  maxWorkers: 1,
};
