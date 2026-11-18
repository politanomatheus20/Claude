import "server-only";
import { createClient, type Client as LibsqlClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Local: arquivo SQLite (file:./data/app.db) — nada para instalar.
 * Produção: Turso (libsql://...) com DATABASE_AUTH_TOKEN.
 */
const globalForDb = globalThis as unknown as { libsql?: LibsqlClient };

const client =
  globalForDb.libsql ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

/**
 * A 1ª query de cada processo é lenta (libSQL inicializa o binding nativo).
 * Aquece em segundo plano para essa espera não cair na 1ª requisição real
 * (ex.: o próximo login depois de um deploy/restart). Ver instrumentation.ts.
 */
client.execute("select 1").catch(() => {});

export const db = drizzle(client, { schema });
export { schema };
