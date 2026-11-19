"use client";

import { Download, Eye, FileText, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { centsToInput, money, parseMoneyToCents, today } from "@/lib/format";
import {
  buildInvestment,
  buildProposal,
  DEFAULT_IMPLANTATION_CENTS,
  DEFAULT_SIGNER_IDS,
  DEFAULT_TRAINING_CENTS,
  defaultProposalNumber,
  PROPOSAL_SIGNERS,
  proposalFileName,
  proposalProblems,
  type Billing,
  type ProposalInput,
  type ProposalLicense,
} from "@/lib/proposal";
import { cn } from "@/lib/utils";

interface OptionalState {
  included: boolean;
  value: string;
}

/**
 * Proposta automatizada: dados do cliente + licenças da calculadora → PDF no
 * padrão do "Modelo Mestre". O PDF é gerado no navegador (módulo carregado só
 * ao clicar), então funciona igual localmente e em produção.
 */
export function ProposalBuilder({
  billing,
  licenses,
  supportMonthlyCents,
}: {
  billing: Billing;
  licenses: ProposalLicense[];
  supportMonthlyCents: number;
}) {
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [number, setNumber] = useState("");
  /** true = nº digitado à mão (não é mais preenchido automaticamente). */
  const [numberEdited, setNumberEdited] = useState(false);
  const [revision, setRevision] = useState("Rev1.0");
  const [issuedAt, setIssuedAt] = useState(() => today());
  const [implantation, setImplantation] = useState<OptionalState>({ included: true, value: centsToInput(DEFAULT_IMPLANTATION_CENTS) });
  const [training, setTraining] = useState<OptionalState>({ included: true, value: centsToInput(DEFAULT_TRAINING_CENTS) });
  const [signerIds, setSignerIds] = useState<string[]>([...DEFAULT_SIGNER_IDS]);
  const [busy, setBusy] = useState<"download" | "preview" | null>(null);

  const input: ProposalInput = {
    clientName,
    contactName,
    number,
    revision,
    issuedAt,
    billing,
    licenses,
    supportMonthlyCents,
    implantation: { included: implantation.included, cents: parseMoneyToCents(implantation.value) ?? 0 },
    training: { included: training.included, cents: parseMoneyToCents(training.value) ?? 0 },
    signers: PROPOSAL_SIGNERS.filter((p) => signerIds.includes(p.id)),
  };
  const problems = proposalProblems(input);
  const investment = buildInvestment(input);
  /** Nº automático: NOME DO CLIENTE em maiúsculas + data de hoje (AAAAMMDD). */
  const autoNumberFor = (name: string) => (name.trim() ? defaultProposalNumber(name, today()) : "");

  function changeClient(name: string) {
    setClientName(name);
    if (!numberEdited) setNumber(autoNumberFor(name));
  }

  function changeNumber(value: string) {
    setNumber(value.toUpperCase());
    setNumberEdited(true);
  }

  function resetAutoNumber() {
    setNumber(autoNumberFor(clientName));
    setNumberEdited(false);
  }

  async function generate(kind: "download" | "preview") {
    if (problems.length > 0 || busy) return;
    // A aba de pré-visualização precisa abrir no clique (senão o navegador bloqueia o pop-up).
    const previewWindow = kind === "preview" ? window.open("", "_blank") : null;
    setBusy(kind);
    try {
      const data = buildProposal(input);
      const { renderProposalPdf } = await import("./proposal-pdf");
      const blob = await renderProposalPdf(data, window.location.origin);
      const url = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = proposalFileName(data);
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Proposta gerada", { description: a.download });
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      previewWindow?.close();
      console.error(err);
      toast.error("Não foi possível gerar a proposta", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  function toggleSigner(id: string) {
    setSignerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const anual = billing === "anual";
  return (
    <Card className="animate-fade-up [animation-delay:160ms]">
      <CardHeader
        title="Proposta automatizada"
        description={`Preencha os dados do cliente — licenças e valores vêm da calculadora acima (aba ${anual ? "Anual" : "Mensal"}). Gera o PDF no padrão do Modelo Mestre.`}
        action={<FileText className="size-5 text-mist/40" aria-hidden />}
      />

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Dados do cliente e da proposta */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Cliente *" htmlFor="pp-client" className="sm:col-span-2">
            <Input id="pp-client" value={clientName} onChange={(e) => changeClient(e.target.value)} placeholder="Ex.: ETPS" autoComplete="off" />
          </Field>
          <Field label="Contato" htmlFor="pp-contact">
            <Input id="pp-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ex.: Luana Cristina" autoComplete="off" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pp-number" className="text-[13px] font-medium text-mist/80">
              Nº da proposta
            </label>
            <Input
              id="pp-number"
              value={number}
              onChange={(e) => changeNumber(e.target.value)}
              onBlur={() => {
                if (!number.trim()) resetAutoNumber();
              }}
              placeholder="CLIENTE + AAAAMMDD"
              autoComplete="off"
              className="uppercase"
            />
            {numberEdited ? (
              <button type="button" onClick={resetAutoNumber} className="w-fit text-left text-xs text-jelly-teal hover:underline">
                ↺ usar automático ({autoNumberFor(clientName) || "CLIENTE + data de hoje"})
              </button>
            ) : (
              <p className="text-xs text-mist/40">Automático: cliente + data de hoje (ano-mês-dia)</p>
            )}
          </div>
          <Field label="Revisão" htmlFor="pp-rev">
            <Input id="pp-rev" value={revision} onChange={(e) => setRevision(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Emitida em" htmlFor="pp-date" hint="Validade: 30 dias">
            <Input id="pp-date" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="[color-scheme:dark]" />
          </Field>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium text-mist/80">Serviços opcionais</legend>
            <div className="grid gap-2">
              <OptionalRow id="pp-impl" label="Implantação Avançada" state={implantation} onChange={setImplantation} />
              <OptionalRow id="pp-train" label="Treinamento para Liderança" state={training} onChange={setTraining} />
            </div>
          </fieldset>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium text-mist/80">Contatos que assinam</legend>
            <div className="grid gap-1.5">
              {PROPOSAL_SIGNERS.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={signerIds.includes(p.id)}
                    onChange={() => toggleSigner(p.id)}
                    className="size-4 accent-[var(--color-jelly-teal)]"
                  />
                  <span className="font-medium">{p.name}</span>
                  <span className="truncate text-xs text-mist/45">{p.role}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Prévia do investimento + gerar */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0 rounded-xl border border-white/[0.07] bg-abyss-deep/40">
            <p className="border-b border-white/[0.06] px-4 py-2.5 text-xs font-medium text-mist/60">
              Investimento na proposta {anual ? "(contrato anual — 12 meses)" : "(valores mensais)"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-white/[0.05]">
                  {investment.recurring.map((r) => (
                    <InvestmentLine key={r.item} label={r.object} qty={quantityLabel(r.quantity, r.unit)} cents={r.totalCents} />
                  ))}
                  <TotalLine label={anual ? "Total estimado (12 meses)" : "Total estimado (mensal)"} cents={investment.recurringTotalCents} />
                  {investment.optional.map((r) => (
                    <InvestmentLine key={r.item} label={r.object} qty="opcional" cents={r.totalCents} />
                  ))}
                  {investment.optional.length > 0 ? <TotalLine label="Total dos opcionais" cents={investment.optionalTotalCents} /> : null}
                </tbody>
              </table>
            </div>
          </div>

          {problems.length > 0 ? (
            <ul className="space-y-1 text-xs text-warn">
              {problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => generate("preview")} disabled={problems.length > 0 || busy !== null}>
              {busy === "preview" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              Pré-visualizar
            </Button>
            <Button type="button" onClick={() => generate("download")} disabled={problems.length > 0 || busy !== null}>
              {busy === "download" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Baixar PDF
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** "9 licenças", "1 serviço", "12 mensalidades" (unidade "Mensal" fica igual). */
function quantityLabel(quantity: string, unit: string) {
  const u = unit.toLowerCase();
  return `${quantity} ${quantity === "1" || u === "mensal" ? u : `${u}s`}`;
}

function OptionalRow({ id, label, state, onChange }: { id: string; label: string; state: OptionalState; onChange: (s: OptionalState) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
      <label htmlFor={`${id}-on`} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-sm">
        <input
          id={`${id}-on`}
          type="checkbox"
          checked={state.included}
          onChange={(e) => onChange({ ...state, included: e.target.checked })}
          className="size-4 shrink-0 accent-[var(--color-jelly-teal)]"
        />
        <span className={cn(!state.included && "text-mist/45")}>{label}</span>
      </label>
      <div className="w-36">
        <MoneyInput
          aria-label={`Valor — ${label}`}
          value={state.value}
          onChange={(e) => onChange({ ...state, value: e.target.value })}
          disabled={!state.included}
          className="h-9 text-right"
        />
      </div>
    </div>
  );
}

function InvestmentLine({ label, qty, cents }: { label: string; qty: string; cents: number | null }) {
  return (
    <tr>
      <td className="px-4 py-2">{label}</td>
      <td className="px-2 py-2 text-right text-xs whitespace-nowrap text-mist/45">{qty}</td>
      <td className="px-4 py-2 text-right whitespace-nowrap tabular">{cents === null ? <span className="text-jelly-teal/80">Cortesia</span> : money(cents)}</td>
    </tr>
  );
}

function TotalLine({ label, cents }: { label: string; cents: number }) {
  return (
    <tr className="bg-white/[0.02] font-medium">
      <td className="px-4 py-2" colSpan={2}>
        {label}
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap tabular">{money(cents)}</td>
    </tr>
  );
}
