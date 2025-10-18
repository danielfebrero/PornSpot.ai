module.exports = {
  projects: [
    {
      displayName: "backend",
      testMatch: ["<rootDir>/backend/__tests__/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      roots: ["<rootDir>/backend"],
      collectCoverageFrom: [
        "backend/functions/**/*.ts",
        "backend/shared/**/*.ts",
        "!**/*.d.ts",
        "!**/node_modules/**",
        "!**/__tests__/**",
      ],
      coverageDirectory: "<rootDir>/coverage/backend",
      setupFilesAfterEnv: ["<rootDir>/backend/__tests__/setup.ts"],
    },
    {
      displayName: "frontend",
      testMatch: [
        "<rootDir>/frontend/__tests__/**/*.test.{js,jsx,ts,tsx}",
        "<rootDir>/frontend/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
        "<rootDir>/frontend/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      ],
      testEnvironment: "jsdom",
      roots: ["<rootDir>/frontend"],
      setupFilesAfterEnv: ["<rootDir>/frontend/jest.setup.js"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/frontend/src/$1",
        "^@/components/(.*)$": "<rootDir>/frontend/src/components/$1",
        "^@/lib/(.*)$": "<rootDir>/frontend/src/lib/$1",
        "^@/types/(.*)$": "<rootDir>/frontend/src/types/$1",
        "^@/hooks/(.*)$": "<rootDir>/frontend/src/hooks/$1",
        "^@/utils/(.*)$": "<rootDir>/frontend/src/utils/$1",
      },
      collectCoverageFrom: [
        "frontend/src/**/*.{js,jsx,ts,tsx}",
        "!frontend/src/**/*.d.ts",
        "!frontend/src/**/*.stories.{js,jsx,ts,tsx}",
        "!frontend/src/**/*.test.{js,jsx,ts,tsx}",
        "!frontend/src/**/*.spec.{js,jsx,ts,tsx}",
        "!frontend/src/**/index.{js,jsx,ts,tsx}",
      ],
      coverageDirectory: "<rootDir>/coverage/frontend",
      transform: {
        "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
      },
      testEnvironmentOptions: {
        customExportConditions: ["react-server", "development"],
      },
      transformIgnorePatterns: [
        "/node_modules/(?!next-intl|@tanstack)",
        "^.+\\.module\\.(css|sass|scss)$",
      ],
    },
  ],
  collectCoverage: true,
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  verbose: true,
  testTimeout: 30000,
};
