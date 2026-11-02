// Prisma CLI configuration (migrations, generate, studio).
// Loads the root .env when present; in CI/production the variables come from the environment.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // Not validated here on purpose: `prisma generate` (run on install) needs no database.
    url: process.env.DATABASE_URL ?? '',
  },
});
