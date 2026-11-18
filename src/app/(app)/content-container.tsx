"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Telas normais ficam centralizadas; Planilha e lista de Clientes usam a tela toda. */
export function ContentContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname.startsWith("/planilha") || pathname === "/clientes";
  return (
    <div className={cn(wide ? "w-full px-4 py-5 sm:px-6" : "mx-auto w-full max-w-[72rem] px-5 py-8 sm:px-8 lg:py-10")}>
      {children}
    </div>
  );
}
