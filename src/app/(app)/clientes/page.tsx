import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/data";
import { date, money, percent } from "@/lib/format";
import { billingLabel, sectorLabel, termLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await listClients(query);

  return (
    <>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes"
        description="Totais somam o contrato principal e as atualizações de cada cliente."
        actions={
          <Button asChild variant="primary">
            <Link href="/clientes/novo">
              <Plus />
              Novo cliente
            </Link>
          </Button>
        }
      />

      <Card className="animate-fade-up">
        <form className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3" role="search">
          <Search className="size-4 text-mist/40" />
          <input name="q" defaultValue={query} placeholder="Buscar por nome ou CNPJ" className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-mist/35" />
          {query ? (
            <Link href="/clientes" className="text-xs text-mist/50 hover:text-mist">
              Limpar
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-mist/55">{query ? `Nada encontrado para “${query}”.` : "Nenhum cliente registrado ainda."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-mist/45">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Assinatura</th>
                  <th className="px-3 py-3 font-medium">Modalidade</th>
                  <th className="px-3 py-3 text-right font-medium">Valor anual</th>
                  <th className="px-3 py-3 text-right font-medium">Total licença</th>
                  <th className="px-3 py-3 text-right font-medium">Resultado</th>
                  <th className="px-3 py-3 text-right font-medium">Na meta/mês</th>
                  <th className="px-3 py-3 font-medium">Vigência</th>
                  <th className="px-5 py-3 font-medium">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map(({ client, main, contracts, totals }) => (
                  <tr key={client.id} className="group transition hover:bg-white/[0.02]">
                    <td className="max-w-72 px-5 py-3">
                      <Link href={`/clientes/${client.id}`} className="flex items-center gap-1.5 font-medium hover:text-jelly-teal">
                        <span className="truncate">{client.name}</span>
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
                      </Link>
                      <span className="text-xs text-mist/40">
                        {sectorLabel[client.sector]}
                        {main?.quantity ? ` · ${main.quantity} licenças` : ""}
                        {contracts.length > 1 ? ` · ${contracts.length} contratos` : ""}
                      </span>
                    </td>
                    <td className="tabular px-3 py-3 text-mist/70">{main?.signedAt ? date(main.signedAt) : "—"}</td>
                    <td className="px-3 py-3">{main ? <Badge tone={main.paymentType === "anual" ? "blue" : "neutral"}>{main.paymentType}</Badge> : "—"}</td>
                    <td className="tabular px-3 py-3 text-right">{money(totals.annual)}</td>
                    <td className="tabular px-3 py-3 text-right text-mist/60">{money(totals.licenseTotal)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={"tabular font-medium " + (totals.result < 0 ? "text-danger" : "")}>{money(totals.result)}</span>
                      <span className="tabular block text-xs text-mist/40">{percent(totals.annual > 0 ? totals.result / totals.annual : null)}</span>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium text-jelly-teal">{money(totals.goalContribution)}</td>
                    <td className="px-3 py-3">
                      {main ? (
                        <Badge tone={termLabel[main.calc.termStatus].tone}>
                          {termLabel[main.calc.termStatus].label}
                          {main.calc.daysToExpire !== null && main.calc.daysToExpire >= 0 ? ` · ${main.calc.daysToExpire}d` : ""}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">{main ? <Badge tone={billingLabel[main.billingStatus].tone}>{billingLabel[main.billingStatus].label}</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
