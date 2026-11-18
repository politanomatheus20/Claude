"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/validation";

/**
 * Retorno visual de uma action:
 * - sucesso → toast;
 * - erro de preenchimento → sem toast (o erro já aparece no campo): leva o cursor
 *   ao primeiro campo inválido. Evita o aviso flutuante cobrir o botão de salvar;
 * - erro geral (ex.: conflito de versão) → toast de erro.
 */
export function useActionFeedback(state: ActionState, onSuccess?: () => void) {
  const last = useRef<ActionState | null>(null);
  const cb = useRef(onSuccess);

  useEffect(() => {
    cb.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (state === last.current || !state.message) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message);
      cb.current?.();
      return;
    }
    const hasFieldErrors = state.errors && Object.values(state.errors).some((e) => e?.length);
    if (!hasFieldErrors) {
      toast.error(state.message);
      return;
    }
    // Espera o React repintar os campos com aria-invalid.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"], main [aria-invalid="true"]');
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }, [state]);
}
