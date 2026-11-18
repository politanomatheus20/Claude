"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/validation";

/** Exibe toast de sucesso/erro sempre que uma action retorna um novo estado. */
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
    } else {
      toast.error(state.message);
    }
  }, [state]);
}
