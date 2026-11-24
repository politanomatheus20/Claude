/**
 * Leitura das variáveis de ambiente do servidor, num lugar só.
 *
 * Aceita os nomes que a integração Turso da Vercel cria automaticamente
 * (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) e os nomes "manuais"
 * (DATABASE_URL / DATABASE_AUTH_TOKEN). Assim, basta conectar o Turso ao
 * projeto na Vercel — não é preciso cadastrar nada à mão.
 *
 * Sem "server-only": também é usado por scripts (importação, migração).
 */

const first = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
};

/** URL do banco (libsql://… no Turso). undefined = não configurado. */
export const databaseUrlFromEnv = () => first("DATABASE_URL", "TURSO_DATABASE_URL", "LIBSQL_URL", "TURSO_URL");

/** Token de acesso do banco Turso. */
export const databaseTokenFromEnv = () => first("DATABASE_AUTH_TOKEN", "TURSO_AUTH_TOKEN", "LIBSQL_AUTH_TOKEN");

export const isVercel = () => Boolean(process.env.VERCEL);
