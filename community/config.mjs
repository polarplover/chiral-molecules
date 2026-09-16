import '../site-config.js';

// Test fixtures are opt-in, confined to the Node test process, and never written
// to site-config.js or the public snapshot.
export const CONFIG = typeof process !== 'undefined' && process.env.NODE_ENV === 'test' && process.env.SOCRATES_TEST_REPOSITORY
  ? globalThis.SOCRATES_CONFIG.forRepository(process.env.SOCRATES_TEST_REPOSITORY)
  : globalThis.SOCRATES_CONFIG;
