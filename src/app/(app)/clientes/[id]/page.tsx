import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, FileText } from "lucide-react";
import { Stat } from "@/components/page-header";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { IOF_RATE, NF_TAX_RATE } from "@/lib/calc";
import { getClient, type ContractRow } from "@/lib/data";
import { date, dateTime, fileSize, money, monthTitle, percent } from "@/lib/format";
import { billingLabel, financialLabel, licenseLabel, sectorLabel, termLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  AddAttachmentDialog,
  AddContractDialog,
  AddInvoiceDialog,
  DeleteClientButton,
  DeleteContractButton,
  EditClientDialog,
  EditContractDialog,
  InvoiceActions,
  ReceiptDialog,
} from "./client-actions";
import { NewClientToast } from "./new-client-toast";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getClient(id);
  return { title: data?.client.name ?? "Cliente" };
}

const pct = (r: number) => `${(r * 100).toLocaleString("pt-BR")}%`;

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) notFound();
  const { client, contracts, totals, versions, invoices, invoicesTotal, files } = data;
  const contractOptions = contracts.map((c) => ({ id: c.id, label: label(c) }));

  return (
    <>
      <NewClientToast />
      <Link href="/clientes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mist/50 transition hover:text-mist">
        <ArrowLeft className="size-4" />
        Clientes
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={client.sector === "governo" ? "blue" : "neutral"}>{sectorLabel[client.sector]}</Badge>
            <Badge>
              {contracts.length} {contracts.length === 1 ? "contrato" : "contratos"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-[28px]">{client.name}</h1>
          <p className="mt-1.5 text-sm text-mist/55">{client.document ? `CNPJ ${client.document}` : "CNPJ não informado"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditClientDialog client={client} />
          <AddContractDialog clientId={client.id} kind="atualizacao" />
        </div>
      </div>

      <Card className="grid animate-fade-up grid-cols-2 max-lg:[&>*]:border-white/[0.06] max-lg:[&>*:nth-child(-n+4)]:border-b lg:grid-cols-6 lg:divide-x lg:divide-white/[0.06]">
        <Stat label="Valor anual (L)" value={money(totals.annual)} />
        <Stat label="Total licença (R)" value={money(totals.licenseTotal)} />
        <Stat label="Consultoria (S)" value={money(totals.consulting)} />
        <Stat
          label="Resultado (T)"
          value={money(totals.result)}
          hint={`Margem ${percent(totals.annual > 0 ? totals.result / totals.annual : null)}`}
          tone={totals.result > 0 ? "positive" : totals.result < 0 ? "negative" : undefined}
        />
        <Stat label="Soma na meta / mês" value={<span className="text-jelly-teal">{money(totals.goalContribution)}</span>} />
        <Stat label="Saldo a receber (AC)" value={money(totals.balanceDue)} />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {contracts.length === 0 ? (
          <Card className="px-5 py-10 text-center text-sm text-mist/45">Nenhum contrato. Registre o primeiro.</Card>
        ) : (
          contracts.map((c, i) => <ContractCard key={c.id} c={c} delay={i * 60} />)
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Card className="animate-fade-up">
            <CardHeader
              title="Invoices"
              description={`Lançado ${money(invoicesTotal)} · custo previsto (R) ${money(totals.licenseTotal)}`}
              action={<AddInvoiceDialog clientId={client.id} contracts={contractOptions} />}
            />
            {invoices.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-mist/45">Nenhuma invoice registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mist/45">
                      <th className="px-5 py-3 font-medium">Número</th>
                      <th className="px-3 py-3 font-medium">Emissão</th>
                      <th className="px-3 py-3 font-medium">Vencimento</th>
                      <th className="px-3 py-3 text-right font-medium">Valor</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-5 py-3">
                          <span className="font-medium">{inv.number}</span>
                          {inv.description ? <span className="block max-w-56 truncate text-xs text-mist/40">{inv.description}</span> : null}
                        </td>
                        <td className="tabular px-3 py-3 text-mist/70">{date(inv.issueDate)}</td>
                        <td className="tabular px-3 py-3 text-mist/70">{inv.dueDate ? date(inv.dueDate) : "—"}</td>
                        <td className="tabular px-3 py-3 text-right font-medium">{money(inv.amountCents)}</td>
                        <td className="px-3 py-3">
                          <Badge tone={inv.status === "paga" ? "teal" : "warn"}>{inv.status}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {inv.file ? (
                              <a href={`/files/${inv.file.id}`} target="_blank" rel="noreferrer" className="flex size-8 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist" title="Ver anexo">
                                <FileText className="size-4" />
                              </a>
                            ) : null}
                            <InvoiceActions invoiceId={inv.id} clientId={client.id} status={inv.status} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title="Histórico" description="Cada atualização gera uma versão" />
            {versions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-mist/45">Sem histórico.</p>
            ) : (
              <ol className="relative px-5 py-5">
                {versions.map((v, i) => (
                  <li key={v.id} className="relative pb-5 pl-6 last:pb-0">
                    {i < versions.length - 1 ? <span className="absolute top-3 bottom-0 left-[5px] w-px bg-white/10" aria-hidden="true" /> : null}
                    <span className={cn("absolute top-1.5 left-0 size-[11px] rounded-full border-2", i === 0 ? "border-jelly-teal bg-jelly-teal/30" : "border-white/25 bg-abyss")} aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium">
                        {v.contractLabel} · v{v.version}
                      </p>
                      <time className="text-[11px] text-mist/40">{dateTime(v.createdAt)}</time>
                    </div>
                    <p className="mt-0.5 text-[13px] text-mist/60">{v.reason}</p>
                    <p className="mt-1 text-[11px] text-mist/35">
                      por {v.author}
                      {v.file ? (
                        <>
                          {" · "}
                          <a href={`/files/${v.file.id}`} target="_blank" rel="noreferrer" className="text-jelly-teal/80 hover:text-jelly-teal">
                            proposta anexada
                          </a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="grid h-fit min-w-0 grid-cols-1 gap-4">
          <Card className="animate-fade-up">
            <CardHeader title="Anexos" action={<AddAttachmentDialog clientId={client.id} />} />
            {files.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-mist/45">Nenhum arquivo anexado.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                    <FileText className={cn("size-4 shrink-0", f.kind === "proposta" ? "text-jelly-teal" : "text-[#7fb0ff]")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{f.name}</p>
                      <p className="text-[11px] text-mist/40">
                        {f.kind} · {fileSize(f.size)} · {date(f.createdAt)}
                      </p>
                    </div>
                    <a href={`/files/${f.id}`} target="_blank" rel="noreferrer" className="flex size-7 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist" title="Visualizar">
                      <Eye className="size-4" />
                    </a>
                    <a href={`/files/${f.id}?download`} className="flex size-7 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist" title="Baixar">
                      <Download className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title="Contato" />
            <dl className="grid gap-3 px-5 py-4 text-sm">
              <Info label="Nome" value={client.contactName} />
              <Info label="E-mail" value={client.contactEmail} href={client.contactEmail ? `mailto:${client.contactEmail}` : undefined} />
              <Info label="Telefone" value={client.contactPhone} href={client.contactPhone ? `tel:${client.contactPhone.replace(/[^\d+]/g, "")}` : undefined} />
            </dl>
            {client.notes ? <p className="border-t border-white/[0.06] px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-mist/70">{client.notes}</p> : null}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
              <AddContractDialog clientId={client.id} kind="principal" variant="link" />
              <DeleteClientButton clientId={client.id} name={client.name} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function label(c: ContractRow) {
  return c.kind === "principal" ? (c.code ?? c.description ?? "Contrato") : `Atualização${c.startAt ? ` de ${date(c.startAt)}` : ""}`;
}

/** Um contrato = uma linha da planilha, organizada em blocos. */
function ContractCard({ c, delay }: { c: ContractRow; delay: number }) {
  const r = c.calc;
  const term = termLabel[r.termStatus];
  const goalMonth = (c.signedAt ?? c.startAt)?.slice(0, 7);

  return (
    <Card className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={c.kind === "principal" ? "blue" : "teal"}>{c.kind === "principal" ? "Contrato" : "Atualização"}</Badge>
            <Badge tone={c.paymentType === "anual" ? "blue" : "neutral"}>{c.paymentType}</Badge>
            <Badge tone={term.tone}>
              {term.label}
              {r.daysToExpire !== null && r.daysToExpire >= 0 ? ` · ${r.daysToExpire}d` : ""}
            </Badge>
            {c.version > 1 ? <Badge>v{c.version}</Badge> : null}
          </div>
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{c.code ?? c.description ?? "Contrato"}</h2>
          <p className="mt-0.5 text-[13px] text-mist/50">
            {[c.description, c.quantity ? `${c.quantity} licenças` : null].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptDialog contractId={c.id} balance={r.balanceDue} />
          <EditContractDialog contract={c} />
          <DeleteContractButton contractId={c.id} />
        </div>
      </header>

      <div className="grid grid-cols-1 divide-white/[0.06] max-lg:divide-y lg:grid-cols-3 lg:divide-x">
        {/* Receita → Resultado */}
        <dl className="grid content-start gap-2 px-5 py-4 text-[13px]">
          <Block>Receita · custo · resultado</Block>
          <Line col="K" label="Valor mensal" value={c.paymentType === "anual" && c.licensesMonthlyCents === null ? "Anual" : money(r.monthly)} />
          <Line col="L" label="Valor anual" value={money(r.annual)} />
          <Line col="M" label={`Imposto NF ${pct(NF_TAX_RATE)}`} value={`− ${money(r.tax)}`} muted manual={c.taxOverrideCents !== null} />
          <Line col="N" label="Valor líquido" value={money(r.net)} strong />
          <Line col="O" label="Claude mensal" value={c.claudeMonthlyCents !== null ? money(c.claudeMonthlyCents) : "—"} muted />
          <Line col="P" label="Licença anual" value={`− ${money(r.claudeAnnual)}`} muted manual={c.claudeAnnualOverrideCents !== null} />
          <Line col="Q" label={`IOF ${pct(IOF_RATE)}`} value={`− ${money(r.iof)}`} muted manual={c.iofOverrideCents !== null} />
          <Line col="R" label="Total licença" value={`− ${money(r.licenseTotal)}`} manual={c.licenseTotalOverrideCents !== null} />
          <Line col="S" label="Consultoria" value={`+ ${money(r.consulting)}`} />
          <div className="mt-1 flex items-baseline justify-between rounded-lg bg-white/[0.04] px-3 py-2">
            <dt className="text-mist/70">
              <span className="mr-1.5 font-mono text-[10px] text-mist/35">T</span>Resultado
            </dt>
            <dd className={cn("tabular font-semibold", r.result < 0 ? "text-danger" : "text-jelly-teal")}>
              {money(r.result)} <span className="text-[11px] font-normal text-mist/40">({percent(r.margin)})</span>
            </dd>
          </div>
        </dl>

        {/* Vigência + meta */}
        <dl className="grid content-start gap-2 px-5 py-4 text-[13px]">
          <Block>Vigência e meta</Block>
          <Line col="F" label="Assinatura" value={c.signedAt ? date(c.signedAt) : "—"} />
          <Line col="G" label="Início" value={c.startAt ? date(c.startAt) : "—"} />
          <Line col="H" label="Fim" value={c.endAt ? date(c.endAt) : "—"} />
          <Line col="AE" label="Dias até vencer" value={r.daysToExpire === null ? "—" : String(r.daysToExpire)} />
          <Line col="J" label="Mensal 2027" value={c.proposal2027MonthlyCents !== null ? money(c.proposal2027MonthlyCents) : "—"} />
          <div className="my-1 h-px bg-white/[0.06]" />
          <Line label={c.paymentType === "anual" ? "Suporte ÷ 12" : "Suporte mensal"} value={money(c.paymentType === "anual" ? c.supportCents / 12 : c.supportCents)} muted />
          <Line label="Treinamento ÷ 12" value={c.trainingCents ? money(c.trainingCents / 12) : "—"} muted />
          <Line label="Soma na meta / mês" value={money(r.goalContribution)} strong />
          {goalMonth ? (
            <p className="text-right text-[11px] text-mist/40">
              conta em{" "}
              <Link href={`/?mes=${goalMonth}`} className="text-mist/60 underline decoration-white/20 underline-offset-2 hover:text-jelly-teal">
                {monthTitle(goalMonth)}
              </Link>
            </p>
          ) : (
            <p className="text-right text-[11px] text-warn">Sem data: não entra em nenhuma meta</p>
          )}
        </dl>

        {/* Financeiro + status */}
        <dl className="grid content-start gap-2 px-5 py-4 text-[13px]">
          <Block>Financeiro e status</Block>
          <Line col="Y" label="Forma de pagamento" value={c.paymentMethod ?? "—"} />
          <Line col="Z" label="Nº de parcelas" value={String(r.installments)} />
          <Line col="AA" label="Valor por parcela" value={money(r.installmentValue)} manual={c.installmentOverrideCents !== null} />
          <Line col="AB" label="Valor recebido" value={money(c.receivedCents)} />
          <Line col="AC" label="Saldo a receber" value={money(r.balanceDue)} strong />
          <div className="my-1 h-px bg-white/[0.06]" />
          <StatusLine col="AF" title="Situação financeira" status={financialLabel[r.financialStatus]} />
          <StatusLine col="V" title="Faturamento" status={billingLabel[c.billingStatus]} />
          <StatusLine col="W" title="Licenças" status={licenseLabel[c.licenseStatus]} />
          <Line col="U" label="Ação" value={c.action ?? "—"} />
          <Line col="AG" label="Responsável" value={c.owner ?? "—"} />
        </dl>
      </div>
    </Card>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-medium tracking-[0.14em] text-mist/40 uppercase">{children}</p>;
}

function Line({ col, label, value, strong, muted, manual }: { col?: string; label: string; value: string; strong?: boolean; muted?: boolean; manual?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("min-w-0", muted ? "text-mist/45" : "text-mist/65")}>
        {col ? <span className="mr-1.5 inline-block w-5 font-mono text-[10px] text-mist/30">{col}</span> : null}
        {label}
        {manual ? (
          <span className="ml-1.5 rounded bg-warn/10 px-1 text-[10px] text-warn" title="Valor digitado (não é a fórmula)">
            manual
          </span>
        ) : null}
      </dt>
      <dd className={cn("tabular min-w-0 truncate text-right", strong ? "font-semibold text-mist" : muted ? "text-mist/55" : "text-mist/85")} title={value}>
        {value}
      </dd>
    </div>
  );
}

function StatusLine({ col, title, status }: { col: string; title: string; status: { label: string; tone: "neutral" | "teal" | "blue" | "warn" | "danger" } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mist/65">
        <span className="mr-1.5 inline-block w-5 font-mono text-[10px] text-mist/30">{col}</span>
        {title}
      </dt>
      <dd>
        <Badge tone={status.tone}>{status.label}</Badge>
      </dd>
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mist/45">{label}</dt>
      <dd className="min-w-0 truncate text-right text-mist/80">
        {value && href ? (
          <a href={href} className="hover:text-jelly-teal">
            {value}
          </a>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}
