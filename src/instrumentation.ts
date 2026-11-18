/**
 * Roda uma vez quando o servidor sobe (Next.js "instrumentation hook").
 * Só serve para importar src/lib/db cedo e disparar o aquecimento da conexão
 * (ver comentário em src/lib/db/index.ts) antes da primeira requisição real.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/db");
  }
}
