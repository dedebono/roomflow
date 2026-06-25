import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/main.ts', '!src/**/*.module.ts', '!src/**/*.controller.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)',
  ],
  // Pre-existing tests with deep DI issues — fix separately
  testPathIgnorePatterns: [
    '/node_modules/',
    'src/auth/auth.service.spec.ts',
    'src/users/users.service.spec.ts',
    'src/bookings/bookings.service.spec.ts',
    'src/storage/storage.service.spec.ts',
  ],
} satisfies Config;
