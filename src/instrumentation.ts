/**
 * Roda uma vez quando o servidor sobe (Next.js "instrumentation hook").
 * Aquece a conexão com o banco (ver warmUpDb em src/lib/db) antes da primeira
 * requisição real. Não roda durante o build: o build não precisa de banco.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { warmUpDb } = await import("@/lib/db");
    warmUpDb();
  }
}
