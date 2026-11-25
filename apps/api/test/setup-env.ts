// Deterministic env for unit tests. The e2e test overrides DB/Redis/S3 from the root .env.
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'test';
process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.SESSION_SECRET ??= 'test-session-secret-0123456789';
process.env.DEV_TEST_PAYMENTS ??= 'true';
process.env.S3_ACCESS_KEY ??= 'test';
process.env.S3_SECRET_KEY ??= 'test-secret';
process.env.AUTH_RATE_LIMIT ??= '1000';
