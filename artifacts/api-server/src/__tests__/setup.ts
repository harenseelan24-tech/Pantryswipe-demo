/**
 * Vitest global setup — executed before each test file is imported.
 *
 * Set all required environment variables here so that workspace packages
 * (e.g. @workspace/db) that read process.env at import time see valid values.
 * Never import app modules from this file.
 */

process.env["NODE_ENV"] = "test";

// Provide a valid-looking DATABASE_URL so the pg Pool is constructed without
// errors.  The CI job supplies a real Postgres; locally you can run
// `docker compose up postgres` and point to localhost.
process.env["DATABASE_URL"] ??=
  "postgresql://test:test@localhost:5432/pantryswipe_test";

// Suppress the Anthropic key requirement for routes that are not under test.
process.env["ANTHROPIC_API_KEY"] ??= "sk-ant-test-key";
