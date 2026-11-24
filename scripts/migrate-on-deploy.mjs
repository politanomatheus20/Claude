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

// Mesmos nomes aceitos por src/lib/env.ts (integração Turso da Vercel ou cadastro manual).
const pick = (...names) => names.map((n) => process.env[n]?.trim()).find(Boolean);
const url = pick("DATABASE_URL", "TURSO_DATABASE_URL", "LIBSQL_URL", "TURSO_URL");
const authToken = pick("DATABASE_AUTH_TOKEN", "TURSO_AUTH_TOKEN", "LIBSQL_AUTH_TOKEN");
if (!url) {
  console.log("[migrate] DATABASE_URL não definida — pulando (banco local usa `npm run setup`).");
  process.exit(0);
}

const client = createClient({ url, authToken });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Banco de dados com as tabelas em dia.");
} catch (err) {
  console.error("[migrate] FALHOU ao preparar o banco de dados:", err instanceof Error ? err.message : err);
  console.error("[migrate] Confira a conexão do Turso com o projeto na Vercel (Storage) ou DATABASE_URL/DATABASE_AUTH_TOKEN.");
  process.exitCode = 1;
} finally {
  client.close();
}
