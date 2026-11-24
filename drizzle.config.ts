import { defineConfig } from "drizzle-kit";

import { databaseTokenFromEnv, databaseUrlFromEnv } from "./src/lib/env";

const url = databaseUrlFromEnv() ?? "file:./data/app.db";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  // O dialeto "turso" (libSQL) aceita tanto file: quanto libsql://
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: databaseTokenFromEnv(),
  },
});
