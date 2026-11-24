import { defineConfig } from 'prisma/config';

// DATABASE_URL comes from the environment (Docker Compose builds it from POSTGRES_PASSWORD).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
