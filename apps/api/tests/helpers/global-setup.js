import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getTestDatabaseUrl } from './test-env.js';

const repoRootUrl = new URL('../../../../', import.meta.url);
const repoRoot = fileURLToPath(repoRootUrl);
const prismaCli = fileURLToPath(new URL('node_modules/prisma/build/index.js', repoRootUrl));

/** Brings the test database schema up to date before any test runs. */
export default function globalSetup() {
  const databaseUrl = getTestDatabaseUrl();
  // Runs the Prisma CLI with Node directly: no shell, so no argument-injection surface.
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
