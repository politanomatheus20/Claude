import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, FileText } from "lucide-react";
import { Stat } from "@/components/page-header";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { monthlySupport, monthlyTraining } from "@/lib/calc";
import { getClient } from "@/lib/data";
import { date, dateTime, fileSize, money, monthLabel, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddAttachmentDialog, AddInvoiceDialog, DeleteClientButton, EditClientDialog, InvoiceActions, UpdateProposalDialog } from "./client-actions";
import { NewClientToast } from "./new-client-toast";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getClient(id);
  return { title: data?.client.name ?? "Cliente" };
}

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const data = await getClient(id);
  if (!data) notFound();
  const { client, result, contribution, versions, invoices, files } = data;

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
            <Badge tone={client.paymentType === "anual" ? "blue" : "neutral"}>{client.paymentType}</Badge>
            <Badge>Proposta v{client.currentVersion}</Badge>
            {client.trainingCents > 0 ? <Badge tone="teal">Treinamento liderança</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{client.name}</h1>
          <p className="mt-1.5 text-sm text-mist/55">
            Fechado em {date(client.closedAt)} · conta na meta de{" "}
            <Link href={`/?mes=${client.closedAt.slice(0, 7)}`} className="text-mist/80 underline decoration-white/20 underline-offset-4 hover:text-jelly-teal">
              {monthLabel(client.closedAt.slice(0, 7))}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditClientDialog client={client} />
          <UpdateProposalDialog client={client} />
        </div>
      </div>

      <Card className="grid animate-fade-up grid-cols-2 max-lg:[&>*]:border-white/[0.06] max-lg:[&>*:nth-child(-n+2)]:border-b lg:grid-cols-4 lg:divide-x lg:divide-white/[0.06]">
        <Stat label="Soma na meta / mês" value={<span className="text-jelly-teal">{money(contribution)}</span>} hint="suporte + treinamento ÷ 12" />
        <Stat label="Receita do contrato" value={money(result.revenueCents)} hint="12 meses" />
        <Stat label="Custo (invoices)" value={money(result.costCents)} hint={`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`} />
        <Stat
          label="Resultado"
          value={money(result.resultCents)}
          hint={`Margem ${percent(result.margin)}`}
          tone={result.resultCents > 0 ? "positive" : result.resultCents < 0 ? "negative" : undefined}
        />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          {/* Proposta vigente */}
          <Card className="animate-fade-up [animation-delay:60ms]">
            <CardHeader title="Proposta vigente" description={`Versão ${client.currentVersion}`} />
            <dl className="grid divide-y divide-white/[0.05] text-sm">
              <Line label={`Licenças ${client.paymentType === "mensal" ? "(mensal)" : "(anual)"}`} value={money(client.licensesCents)} note="Não entra na meta" />
              <Line
                label={`Suporte ${client.paymentType === "mensal" ? "(mensal)" : "(anual)"}`}
                value={money(client.supportCents)}
                note={client.paymentType === "anual" ? `÷ 12 = ${money(monthlySupport(client))}/mês` : "Entra direto na meta"}
              />
              <Line
                label="Treinamento para liderança"
                value={client.trainingCents > 0 ? money(client.trainingCents) : "Não contratado"}
                note={client.trainingCents > 0 ? `÷ 12 = ${money(monthlyTraining(client))}/mês` : undefined}
              />
            </dl>
          </Card>

          {/* Invoices */}
          <Card className="animate-fade-up [animation-delay:120ms]">
            <CardHeader title="Invoices" description="Compõem o custo e o resultado do cliente" action={<AddInvoiceDialog clientId={client.id} />} />
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
                              <a
                                href={`/files/${inv.file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex size-8 items-center justify-center rounded-md text-mist/50 hover:bg-white/5 hover:text-mist"
                                title="Ver anexo"
                              >
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

          {client.notes ? (
            <Card className="animate-fade-up [animation-delay:180ms]">
              <CardHeader title="Observações" />
              <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-mist/75">{client.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="grid h-fit min-w-0 grid-cols-1 gap-4">
          {/* Histórico */}
          <Card className="animate-fade-up [animation-delay:90ms]">
            <CardHeader title="Histórico da proposta" />
            <ol className="relative px-5 py-5">
              {versions.map((v, i) => {
                const prev = versions[i + 1];
                const delta = prev ? v.contribution - prev.contribution : null;
                return (
                  <li key={v.id} className="relative pb-6 pl-6 last:pb-0">
                    {i < versions.length - 1 ? <span className="absolute top-3 bottom-0 left-[5px] w-px bg-white/10" aria-hidden="true" /> : null}
                    <span
                      className={cn(
                        "absolute top-1.5 left-0 size-[11px] rounded-full border-2",
                        i === 0 ? "border-jelly-teal bg-jelly-teal/30" : "border-white/25 bg-abyss",
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">Versão {v.version}</p>
                      <time className="text-[11px] text-mist/40">{dateTime(v.createdAt)}</time>
                    </div>
                    <p className="mt-0.5 text-[13px] text-mist/60">{v.reason}</p>
                    <p className="tabular mt-1.5 text-xs text-mist/50">
                      {v.paymentType} · meta {money(v.contribution)}/mês
                      {delta !== null && delta !== 0 ? (
                        <span className={delta > 0 ? "ml-1.5 text-jelly-teal" : "ml-1.5 text-danger"}>
                          {delta > 0 ? "+" : "−"}
                          {money(Math.abs(delta))}
                        </span>
                      ) : null}
                    </p>
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
                );
              })}
            </ol>
          </Card>

          {/* Anexos */}
          <Card className="animate-fade-up [animation-delay:150ms]">
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

          <Card className="animate-fade-up [animation-delay:210ms]">
            <CardHeader title="Dados do cliente" />
            <dl className="grid gap-3 px-5 py-4 text-sm">
              <Info label="CNPJ" value={client.document} />
              <Info label="Contato" value={client.contactName} />
              <Info label="E-mail" value={client.contactEmail} />
              <Info label="Registrado em" value={dateTime(client.createdAt)} />
            </dl>
            <div className="border-t border-white/[0.06] px-5 py-3">
              <DeleteClientButton clientId={client.id} name={client.name} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <dt>
        <span className="text-mist/80">{label}</span>
        {note ? <span className="block text-xs text-mist/40">{note}</span> : null}
      </dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mist/45">{label}</dt>
      <dd className="truncate text-right text-mist/80">{value || "—"}</dd>
    </div>
  );
}
