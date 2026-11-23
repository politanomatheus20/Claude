import "server-only";
import { createClient, type Client as LibsqlClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Local: arquivo SQLite (file:./data/app.db) — nada para instalar.
 * Produção (Vercel): Turso (libsql://...) com DATABASE_AUTH_TOKEN.
 *
 * A conexão é criada só no PRIMEIRO USO (não ao importar o módulo): o build
 * da Vercel ("Collecting page data") importa as rotas sem acessar o banco, e
 * não pode depender dele — antes, a falta de DATABASE_URL derrubava o build.
 */
type Database = LibSQLDatabase<typeof schema> & { $client: LibsqlClient };

const globalForDb = globalThis as unknown as { libsql?: LibsqlClient };

function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  // Na Vercel não existe disco persistente: o arquivo local nunca funcionaria.
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL não configurada na Vercel. Cadastre DATABASE_URL (libsql://...turso.io) e DATABASE_AUTH_TOKEN em Settings → Environment Variables e faça um novo deploy.",
    );
  }
  return "file:./data/app.db";
}

function getClient() {
  if (!globalForDb.libsql) {
    globalForDb.libsql = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined });
  }
  return globalForDb.libsql;
}

let instance: Database | undefined;
const getDb = () => (instance ??= drizzle(getClient(), { schema }));

/** Mesma API do drizzle; a conexão só abre quando alguma consulta é feita. */
export const db = new Proxy({} as Database, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/**
 * A 1ª query de cada processo é lenta (libSQL inicializa o binding nativo).
 * Chamado no início do servidor (instrumentation.ts) para essa espera não cair
 * na 1ª requisição real. Nunca lança: se o banco não estiver configurado, o erro
 * aparece (com a mensagem acima) na primeira página que precisar dele.
 */
export function warmUpDb() {
  try {
    getClient().execute("select 1").catch(() => {});
  } catch {
    // sem configuração — ver databaseUrl()
  }
}

export { schema };
