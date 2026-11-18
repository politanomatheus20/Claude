import type { Metadata } from "next";
import Image from "next/image";
import { JellyfishVideo } from "@/components/jellyfish-video";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden bg-abyss-deep">
      <JellyfishVideo />
      <div className="grain pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-[76rem] items-center justify-between px-6 pt-8 sm:px-10">
        <Image src="/brand/logo-dark-bg.svg" alt="DataGroup" width={168} height={28} priority className="h-7 w-auto" />
        <span className="hidden text-xs tracking-[0.18em] text-mist/40 uppercase sm:inline">Uso interno</span>
      </header>

      <section className="mx-auto flex w-full max-w-[76rem] flex-1 items-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <p className="mb-6 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-jelly-teal uppercase">
            <span className="h-px w-6 bg-jelly-teal/60" />
            Metas · Claude
          </p>

          <h1
            lang="en"
            className="text-4xl leading-[1.04] font-semibold tracking-tight [filter:drop-shadow(0_2px_20px_rgb(0_0_0/0.7))] sm:text-5xl"
          >
            Where data <span className="font-display font-normal tracking-normal text-jelly-teal uppercase">flows,</span>
            <br />
            possibilities <span className="text-brand-gradient font-display font-normal tracking-normal uppercase">grow.</span>
          </h1>

          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-mist/65">
            Clientes fechados, propostas, invoices e a meta do mês num só lugar. Entre com seu e-mail corporativo.
          </p>

          <LoginForm />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[76rem] items-center justify-between gap-6 px-6 pb-8 text-xs text-mist/35 sm:px-10">
        <span>© {new Date().getFullYear()} DataGroup</span>
        <span className="flex items-center gap-2">
          Parceiro oficial
          <Image src="/brand/claude-light.svg" alt="Claude" width={64} height={16} className="h-4 w-auto opacity-70" />
        </span>
      </footer>
    </main>
  );
}
