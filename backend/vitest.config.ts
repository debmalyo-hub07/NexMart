import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Source tests only — `tsc` builds into dist/ (including compiled test
    // files), and vitest's default glob would pick those stale CommonJS
    // copies up as broken suites.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Deterministic env for hermetic unit tests. Importing most modules pulls
    // in config/env.ts, which validates env and process.exit(1)s if anything
    // required is missing — so the suite crashes in any environment without a
    // real .env (e.g. CI). These are DUMMY placeholders, present only to
    // satisfy the zod schema; every external call (Mongo / Redis / Razorpay /
    // Cloudinary / SMTP) is mocked in the tests, so no real service is ever
    // contacted and no secret is needed. Set here (not in CI config) so the
    // suite is hermetic for CI and any fresh checkout alike.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/nexmart_test',
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      RAZORPAY_KEY_ID: 'rzp_test_dummy',
      RAZORPAY_KEY_SECRET: 'test-razorpay-secret',
      JWT_SECRET_ADMIN: 'test-jwt-admin-secret',
      JWT_SECRET_CUSTOMER: 'test-jwt-customer-secret',
      JWT_SECRET_AGENT: 'test-jwt-agent-secret',
      SMTP_USER: 'test-smtp-user',
      SMTP_PASSWORD: 'test-smtp-password',
      ADMIN_SEED_EMAIL: 'admin@test.local',
      ADMIN_SEED_PASSWORD: 'test-seed-password',
      ADMIN_SECRET_KEY: 'test-admin-secret-key',
    },
  },
});
