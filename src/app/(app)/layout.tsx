import Image from "next/image";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { initials } from "@/lib/format";
import { logout } from "../login/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-white/[0.06] bg-abyss-deep/90 backdrop-blur-xl lg:h-svh lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between gap-4 px-5 lg:h-20">
          <Link href="/" className="flex items-center" aria-label="Início">
            <Image src="/brand/logo-dark-bg.svg" alt="DataGroup" width={132} height={22} priority className="h-[22px] w-auto" />
          </Link>
          <Link
            href="/clientes/novo"
            className="inline-flex size-8 items-center justify-center rounded-lg bg-mist text-abyss-deep lg:hidden"
            aria-label="Novo cliente"
          >
            <Plus className="size-4" />
          </Link>
        </div>

        <div className="hidden px-3 lg:block">
          <Link
            href="/clientes/novo"
            className="group flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-mist transition hover:border-jelly-teal/40 hover:bg-jelly-teal/[0.06]"
          >
            <Plus className="size-4 text-jelly-teal" />
            Novo cliente
            <kbd className="ml-auto rounded border border-white/10 px-1.5 text-[10px] text-mist/40">N</kbd>
          </Link>
        </div>

        <NavLinks />

        <div className="mt-auto hidden border-t border-white/[0.06] p-3 lg:block">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-jelly-blue to-jelly-teal text-[11px] font-semibold text-white">
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-[11px] text-mist/40">{user.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Sair"
                className="flex size-8 items-center justify-center rounded-md text-mist/40 transition hover:bg-white/5 hover:text-mist"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-2 text-[11px] text-mist/30">
            Parceiro oficial
            <Image src="/brand/claude-light.svg" alt="Claude" width={44} height={11} className="h-[11px] w-auto opacity-60" />
          </p>
        </div>
      </aside>

      <main className="relative isolate min-w-0 flex-1 overflow-x-clip">
        <div className="grain pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -top-48 right-0 -z-10 h-[28rem] w-[40rem] rounded-full bg-jelly-blue/[0.07] blur-[120px]"
          aria-hidden="true"
        />
        <div className="mx-auto w-full max-w-[72rem] px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
