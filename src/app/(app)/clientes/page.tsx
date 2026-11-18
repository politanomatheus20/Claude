import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listClients } from "@/lib/data";
import { date, money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await listClients(query);

  return (
    <>
      <PageHeader
        eyebrow="Clientes"
        title="Clientes fechados"
        description="Propostas vigentes, custo das invoices e resultado de cada contrato."
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
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nome ou CNPJ"
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-mist/35"
          />
          {query ? (
            <Link href="/clientes" className="text-xs text-mist/50 hover:text-mist">
              Limpar
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-mist/55">{query ? `Nada encontrado para “${query}”.` : "Nenhum cliente registrado ainda."}</p>
            {!query ? (
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href="/clientes/novo">
                  <Plus />
                  Registrar o primeiro
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-mist/45">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Fechamento</th>
                  <th className="px-3 py-3 font-medium">Pagamento</th>
                  <th className="px-3 py-3 text-right font-medium">Na meta/mês</th>
                  <th className="px-3 py-3 text-right font-medium">Receita (12m)</th>
                  <th className="px-3 py-3 text-right font-medium">Custo</th>
                  <th className="px-5 py-3 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((c) => (
                  <tr key={c.id} className="group transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/clientes/${c.id}`} className="flex items-center gap-1.5 font-medium hover:text-jelly-teal">
                        {c.name}
                        <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" />
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-mist/40">
                        v{c.currentVersion}
                        {c.trainingCents > 0 ? <span className="text-jelly-teal/70">· liderança</span> : null}
                      </span>
                    </td>
                    <td className="tabular px-3 py-3 text-mist/70">{date(c.closedAt)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={c.paymentType === "anual" ? "blue" : "neutral"}>{c.paymentType}</Badge>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium text-jelly-teal">{money(c.contribution)}</td>
                    <td className="tabular px-3 py-3 text-right">{money(c.result.revenueCents)}</td>
                    <td className="tabular px-3 py-3 text-right text-mist/60">{money(c.result.costCents)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={"tabular font-medium " + (c.result.resultCents < 0 ? "text-danger" : "")}>
                        {money(c.result.resultCents)}
                      </span>
                      <span className="tabular block text-xs text-mist/40">{percent(c.result.margin)}</span>
                    </td>
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
