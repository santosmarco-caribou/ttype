/* eslint-disable no-undef */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__test__/'],
  transform: {
    '\\.ts$': ['ts-jest', { diagnostics: false }],
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
}
