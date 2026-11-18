"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/** Confirmação após o cadastro (vem de ?novo=1) e limpa a URL. */
export function NewClientToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("novo") === "1") {
      toast.success("Cliente registrado. A meta do mês já foi atualizada.");
      router.replace(pathname, { scroll: false });
    }
  }, [params, router, pathname]);

  return null;
}
