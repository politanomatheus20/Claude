import "server-only";

/**
 * Diagnóstico de configuração do servidor, em português, para não cair na
 * tela genérica "This page couldn't load" quando falta algo na Vercel.
 * Só cita NOMES de variáveis — nunca valores.
 */

/** O que falta configurar (vazio = tudo certo). */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (process.env.VERCEL && !process.env.DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL e DATABASE_AUTH_TOKEN (banco Turso)");
  }
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.length ?? 0) < 32) {
    missing.push("SESSION_SECRET (mínimo 32 caracteres)");
  }
  return missing;
}

export function missingConfigMessage(missing: string[]) {
  return `O sistema ainda não está configurado no servidor — falta cadastrar na Vercel: ${missing.join("; ")}. Avise o responsável pelo sistema.`;
}

/** Traduz um erro técnico do servidor numa orientação para quem está usando. */
export function describeServerError(err: unknown): string {
  const msg = err instanceof Error ? `${err.message} ${String((err as { cause?: unknown }).cause ?? "")}` : String(err);
  if (/no such table/i.test(msg)) {
    return "O banco de dados ainda não foi preparado. Faça um novo deploy na Vercel (as tabelas são criadas automaticamente) e tente de novo.";
  }
  if (/DATABASE_URL/.test(msg)) return missingConfigMessage(["DATABASE_URL e DATABASE_AUTH_TOKEN (banco Turso)"]);
  if (/SESSION_SECRET/.test(msg)) return missingConfigMessage(["SESSION_SECRET (mínimo 32 caracteres)"]);
  if (/401|403|unauthori[sz]ed|forbidden|auth|token|ENOTFOUND|ECONNREFUSED|fetch failed|SERVER_ERROR|HRANA/i.test(msg)) {
    return "Não foi possível conectar ao banco de dados. Confira DATABASE_URL e DATABASE_AUTH_TOKEN na Vercel.";
  }
  return "Ocorreu um erro inesperado no servidor. Tente novamente em instantes; se continuar, avise o responsável pelo sistema.";
}
