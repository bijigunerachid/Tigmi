/** Jest runs native ES modules (no Babel): see the "test" script for the Node flag. */
export default {
  testEnvironment: 'node',
  transform: {},
  roots: ['<rootDir>/tests'],
  globalSetup: '<rootDir>/tests/helpers/global-setup.js',
  clearMocks: true,
  restoreMocks: true,
};
