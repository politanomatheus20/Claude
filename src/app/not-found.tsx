import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl text-brand-gradient">404</p>
      <p className="text-mist/60">Não encontramos esta página.</p>
      <Link href="/" className="text-sm text-jelly-teal hover:underline">
        Voltar ao painel
      </Link>
    </main>
  );
}
