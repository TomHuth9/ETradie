import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library's auto-cleanup doesn't reliably self-register under
// Vitest in this project (confirmed: without this, multiple tests in the
// same file that each call render() leave prior renders mounted, and the
// resulting duplicate/stale DOM makes later queries in the file hang for the
// full test timeout instead of failing fast). Registering it explicitly here
// covers every test file.
afterEach(() => {
  cleanup();
});

