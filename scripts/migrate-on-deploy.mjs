/**
 * Roda antes do `next build` (ver "build" no package.json).
 *
 * Na Vercel, com DATABASE_URL configurada (Turso), cria/atualiza as tabelas do
 * banco a partir de ./drizzle — assim um banco novo (vazio) já funciona no
 * primeiro deploy, sem precisar rodar nada à mão. Sem DATABASE_URL (ex.: no
 * computador, que usa o arquivo local), não faz nada: o local usa `npm run setup`.
 *
 * As migrações só acrescentam estrutura e cada uma roda uma única vez (ficam
 * registradas na tabela __drizzle_migrations), então rodar a cada deploy é seguro.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("[migrate] DATABASE_URL não definida — pulando (banco local usa `npm run setup`).");
  process.exit(0);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Banco de dados com as tabelas em dia.");
} catch (err) {
  console.error("[migrate] FALHOU ao preparar o banco de dados:", err instanceof Error ? err.message : err);
  console.error("[migrate] Confira DATABASE_URL e DATABASE_AUTH_TOKEN em Settings → Environment Variables na Vercel.");
  process.exitCode = 1;
} finally {
  client.close();
}
