import "server-only";
import { sessionKeySource } from "./auth/session";
import { databaseUrlFromEnv } from "./env";

/**
 * Diagnóstico de configuração do servidor, em português, para não cair na
 * tela genérica "This page couldn't load" quando falta algo na Vercel.
 * Só cita NOMES de variáveis — nunca valores.
 */

/** O que falta configurar (vazio = tudo certo). */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (process.env.VERCEL && !databaseUrlFromEnv()) {
    missing.push("o banco de dados Turso (Vercel → projeto → Storage → conectar Turso)");
  } else if (sessionKeySource() === null) {
    // Só acontece se houver URL do banco mas sem token e sem SESSION_SECRET.
    missing.push("o token do banco Turso (TURSO_AUTH_TOKEN) ou SESSION_SECRET");
  }
  return missing;
}

export function missingConfigMessage(missing: string[]) {
  return `O sistema ainda não está configurado no servidor — falta conectar ${missing.join("; ")}. Avise o responsável pelo sistema.`;
}

/** Traduz um erro técnico do servidor numa orientação para quem está usando. */
export function describeServerError(err: unknown): string {
  const msg = err instanceof Error ? `${err.message} ${String((err as { cause?: unknown }).cause ?? "")}` : String(err);
  if (/no such table/i.test(msg)) {
    return "O banco de dados ainda não foi preparado. Faça um novo deploy na Vercel (as tabelas são criadas automaticamente) e tente de novo.";
  }
  if (/DATABASE_URL/.test(msg)) return missingConfigMessage(["o banco de dados Turso (Vercel → projeto → Storage → conectar Turso)"]);
  if (/SESSION_SECRET/.test(msg)) return missingConfigMessage(["o token do banco Turso (TURSO_AUTH_TOKEN) ou SESSION_SECRET"]);
  if (/401|403|unauthori[sz]ed|forbidden|auth|token|ENOTFOUND|ECONNREFUSED|fetch failed|SERVER_ERROR|HRANA/i.test(msg)) {
    return "Não foi possível conectar ao banco de dados. Confira a conexão do Turso com o projeto na Vercel.";
  }
  return "Ocorreu um erro inesperado no servidor. Tente novamente em instantes; se continuar, avise o responsável pelo sistema.";
}
