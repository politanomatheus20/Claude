"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Erro inesperado em qualquer página: mensagem em português (no lugar da tela
 * genérica "This page couldn't load") com o código para informar o suporte.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function retry() {
    // Erros do servidor só somem buscando a página de novo.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="flex min-h-[70svh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-warn/10 text-warn">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-mist">Não foi possível carregar esta página</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist/60">
          Ocorreu um erro no servidor. Tente novamente em instantes. Se continuar, informe o código abaixo ao responsável pelo sistema.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-mist px-4 text-sm font-medium text-abyss-deep transition hover:bg-white"
          >
            <RotateCcw className="size-4" aria-hidden />
            Tentar novamente
          </button>
          <Link href="/login" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm text-mist/80 transition hover:bg-white/5">
            Ir para o login
          </Link>
        </div>
        {error.digest ? <p className="mt-8 font-mono text-[11px] text-mist/30">Código: {error.digest}</p> : null}
      </div>
    </main>
  );
}
