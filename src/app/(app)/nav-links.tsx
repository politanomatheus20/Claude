"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Gauge, Target, Users } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Painel", icon: Gauge, match: (p: string) => p === "/" },
  { href: "/clientes", label: "Clientes", icon: Users, match: (p: string) => p.startsWith("/clientes") },
  { href: "/metas", label: "Metas", icon: Target, match: (p: string) => p.startsWith("/metas") },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();

  // Atalho "N" para novo cliente (fora de campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      router.push("/clientes/novo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-6 lg:flex-col lg:pb-0" aria-label="Principal">
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition",
              active ? "bg-white/[0.06] text-mist" : "text-mist/55 hover:bg-white/[0.03] hover:text-mist",
            )}
          >
            {active ? (
              <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-jelly-teal lg:block" aria-hidden="true" />
            ) : null}
            <Icon className={cn("size-4", active ? "text-jelly-teal" : "")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
