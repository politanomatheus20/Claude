import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/data";
import { date, money, percent } from "@/lib/format";
import { billingLabel, licenseLabel, sectorLabel, termLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

const th = "border-b border-white/[0.1] bg-surface px-2 py-2.5 font-medium whitespace-nowrap";
const td = "h-10 border-b border-white/[0.05] px-2 whitespace-nowrap";

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await listClients(query);

  const sum = (k: "annual" | "licenseTotal" | "consulting" | "result" | "goalContribution" | "balanceDue") => rows.reduce((s, r) => s + r.totals[k], 0);
  const totalAnnual = sum("annual");
  const totalResult = sum("result");

  return (
    <div className="flex h-[calc(100svh-9.5rem)] min-h-[28rem] flex-col gap-3 lg:h-[calc(100svh-2.5rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Clientes</h1>
          <span className="text-xs text-mist/40">{rows.length}</span>
        </div>
        <form role="search" className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-abyss-deep/60 px-3 focus-within:border-jelly-teal/60 sm:w-auto sm:min-w-[15rem] sm:flex-1 sm:max-w-sm">
          <Search className="size-4 shrink-0 text-mist/40" />
          <input name="q" defaultValue={query} placeholder="Nome ou CNPJ" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mist/35" />
          {query ? (
            <Link href="/clientes" className="text-xs text-mist/50 hover:text-mist">
              Limpar
            </Link>
          ) : null}
        </form>
        <p className="tabular hidden text-xs text-mist/45 md:block">
          Resultado <b className={totalResult < 0 ? "text-danger" : "text-jelly-teal"}>{money(totalResult)}</b> · na meta/mês{" "}
          <b className="text-mist/80">{money(sum("goalContribution"))}</b>
        </p>
        <Button asChild variant="primary" size="sm" className="ml-auto h-9">
          <Link href="/clientes/novo">
            <Plus />
            Novo cliente
          </Link>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-card)] border border-white/[0.08] bg-abyss shadow-[var(--shadow-card)]">
        {rows.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-mist/55">{query ? `Nada encontrado para “${query}”.` : "Nenhum cliente registrado ainda."}</p>
        ) : (
          <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-[12.5px]">
            <thead className="sticky top-0 z-20 text-left text-xs text-mist/55">
              <tr>
                <th className={cn(th, "sticky left-0 z-10 border-r border-r-white/[0.08] px-4")}>Cliente</th>
                <th className={th}>Assinatura</th>
                <th className={th}>Modalidade</th>
                <th className={cn(th, "text-right")}>Qtd</th>
                <th className={cn(th, "text-right")}>Valor anual</th>
                <th className={cn(th, "text-right")}>Total licença</th>
                <th className={cn(th, "text-right")}>Resultado</th>
                <th className={cn(th, "text-right")}>Na meta/mês</th>
                <th className={cn(th, "text-right")}>Saldo a receber</th>
                <th className={th}>Vigência</th>
                <th className={cn(th, "pr-4")} title="Faturamento e licenças">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, main, contracts, totals }) => {
                const qty = contracts.reduce((s, c) => s + (c.quantity ?? 0), 0);
                return (
                  <tr key={client.id} className="group">
                    <td className={cn(td, "sticky left-0 z-10 min-w-[10rem] max-w-[15rem] border-r border-r-white/[0.08] bg-abyss px-4 py-1.5 whitespace-normal group-hover:bg-surface")}>
                      <Link
                        href={`/clientes/${client.id}`}
                        title={`${client.name}${client.document ? ` · CNPJ ${client.document}` : ""}`}
                        className="flex items-center gap-1.5 font-medium hover:text-jelly-teal"
                      >
                        <span className="min-w-0 break-words">{client.name}</span>
                        {client.sector === "governo" ? <span className="shrink-0 text-[10px] font-normal tracking-wide text-[#7fb0ff] uppercase">{sectorLabel.governo}</span> : null}
                        {contracts.length > 1 ? <span className="shrink-0 text-[11px] font-normal text-mist/40">+{contracts.length - 1}</span> : null}
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
                      </Link>
                    </td>
                    <td className={cn(td, "tabular text-mist/70 group-hover:bg-white/[0.025]")}>{main?.signedAt ? `${main.signedAt.slice(8, 10)}/${main.signedAt.slice(5, 7)}/${main.signedAt.slice(2, 4)}` : "—"}</td>
                    <td className={cn(td, "text-[12px] capitalize group-hover:bg-white/[0.025]", main?.paymentType === "anual" ? "text-[#7fb0ff]" : "text-mist/65")}>{main?.paymentType ?? "—"}</td>
                    <td className={cn(td, "tabular text-right group-hover:bg-white/[0.025]")}>{qty || "—"}</td>
                    <td className={cn(td, "tabular text-right group-hover:bg-white/[0.025]")}>{money(totals.annual)}</td>
                    <td className={cn(td, "tabular text-right text-mist/65 group-hover:bg-white/[0.025]")}>{money(totals.licenseTotal)}</td>
                    <td className={cn(td, "text-right group-hover:bg-white/[0.025]")}>
                      <span
                        className={cn("tabular font-medium", totals.result < 0 ? "text-danger" : "text-jelly-teal")}
                        title={`Margem ${percent(totals.annual > 0 ? totals.result / totals.annual : null)}`}
                      >
                        {money(totals.result)}
                      </span>
                    </td>
                    <td className={cn(td, "tabular text-right font-medium group-hover:bg-white/[0.025]")}>{totals.goalContribution ? money(totals.goalContribution) : "—"}</td>
                    <td className={cn(td, "tabular text-right text-mist/75 group-hover:bg-white/[0.025]")}>{money(totals.balanceDue)}</td>
                    <td className={cn(td, "group-hover:bg-white/[0.025]")}>
                      {main ? (
                        <Badge tone={termLabel[main.calc.termStatus].tone} title={main.endAt ? `Fim em ${date(main.endAt)}` : undefined}>
                          {main.calc.daysToExpire !== null && main.calc.daysToExpire >= 0 ? `${main.calc.daysToExpire}d` : termLabel[main.calc.termStatus].label}
                        </Badge>
                      ) : null}
                    </td>
                    <td className={cn(td, "pr-4 group-hover:bg-white/[0.025]")}>
                      {main ? (
                        <span className="flex gap-1">
                          <Badge tone={billingLabel[main.billingStatus].tone} title={`Faturamento: ${billingLabel[main.billingStatus].label}`}>
                            Fat
                          </Badge>
                          <Badge tone={licenseLabel[main.licenseStatus].tone} title={`Licenças: ${licenseLabel[main.licenseStatus].label}`}>
                            Lic
                          </Badge>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="tabular bg-surface-2 text-right font-medium">
                <td className="sticky left-0 z-10 border-t border-r border-white/[0.12] bg-surface-2 px-4 py-2.5 text-left text-[11px] tracking-wide text-mist/60 uppercase">Total</td>
                <td colSpan={3} className="border-t border-white/[0.12]" />
                <td className="border-t border-white/[0.12] px-2 py-2.5">{money(totalAnnual)}</td>
                <td className="border-t border-white/[0.12] px-2 py-2.5">{money(sum("licenseTotal"))}</td>
                <td className={cn("border-t border-white/[0.12] px-2 py-2.5", totalResult < 0 ? "text-danger" : "text-jelly-teal")}>{money(totalResult)}</td>
                <td className="border-t border-white/[0.12] px-2 py-2.5">{money(sum("goalContribution"))}</td>
                <td className="border-t border-white/[0.12] px-2 py-2.5">{money(sum("balanceDue"))}</td>
                <td colSpan={2} className="border-t border-white/[0.12]" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
