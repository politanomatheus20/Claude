/**
 * Tela de carregamento entre páginas: aparece no mesmo instante do clique
 * (o menu continua no lugar) enquanto os dados da próxima página chegam.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Carregando">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="h-7 w-64 max-w-full rounded bg-white/[0.08]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius-card)] border border-white/[0.05] bg-white/[0.03]" />
        ))}
      </div>
      <div className="mt-4 h-72 rounded-[var(--radius-card)] border border-white/[0.05] bg-white/[0.03]" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
