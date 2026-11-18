"use client";

import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { computeContract, IOF_RATE, NF_TAX_RATE, type ContractValues } from "@/lib/calc";
import type { Contract, PaymentType } from "@/lib/db/schema";
import { centsToInput, money, parseMoneyToCents, percent } from "@/lib/format";
import { ACTION_SUGGESTIONS, PAYMENT_METHOD_SUGGESTIONS, PRODUCT_SUGGESTIONS } from "@/lib/labels";
import type { FieldErrors } from "@/lib/validation";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Nomes dos campos do formulário ↔ colunas da planilha. */
const MONEY_FIELDS = {
  licensesMonthly: "licensesMonthlyCents", // K
  licensesAnnual: "licensesAnnualOverrideCents", // L
  proposal2027Monthly: "proposal2027MonthlyCents", // J
  taxOverride: "taxOverrideCents", // M
  claudeMonthly: "claudeMonthlyCents", // O
  claudeAnnual: "claudeAnnualOverrideCents", // P
  iofOverride: "iofOverrideCents", // Q
  licenseTotalOverride: "licenseTotalOverrideCents", // R
  support: "supportCents",
  training: "trainingCents",
  installmentOverride: "installmentOverrideCents", // AA
  received: "receivedCents", // AB
} as const;
type MoneyField = keyof typeof MONEY_FIELDS;

const pct = (r: number) => `${(r * 100).toLocaleString("pt-BR")}%`;

/**
 * Todos os campos de um contrato (uma linha da planilha) + prévia ao vivo
 * calculada com as MESMAS funções do servidor (src/lib/calc.ts).
 */
export function ContractFields({
  defaults,
  values,
  errors,
}: {
  defaults?: Partial<Contract>;
  values?: Record<string, string>;
  errors?: FieldErrors;
}) {
  const initMoney = (f: MoneyField) => {
    if (values) return values[f] ?? "";
    const v = defaults?.[MONEY_FIELDS[f]];
    return typeof v === "number" && (v !== 0 || f === "support") ? centsToInput(v) : "";
  };

  const [paymentType, setPaymentType] = useState<PaymentType>(
    (values?.paymentType as PaymentType) ?? defaults?.paymentType ?? "mensal",
  );
  const [m, setM] = useState<Record<MoneyField, string>>(
    () => Object.fromEntries(Object.keys(MONEY_FIELDS).map((k) => [k, initMoney(k as MoneyField)])) as Record<MoneyField, string>,
  );
  const [installments, setInstallments] = useState(values?.installments ?? (defaults?.installments?.toString() ?? ""));
  const [hasTraining, setHasTraining] = useState(values ? values.hasTraining === "on" : Boolean(defaults?.trainingCents));
  const [endAt, setEndAt] = useState(values?.endAt ?? defaults?.endAt ?? "");
  const [showAdjust, setShowAdjust] = useState(
    Boolean(defaults?.taxOverrideCents ?? defaults?.iofOverrideCents ?? defaults?.licenseTotalOverrideCents ?? values?.taxOverride ?? values?.iofOverride ?? values?.licenseTotalOverride),
  );

  const c = (f: MoneyField) => parseMoneyToCents(m[f]);
  const K = c("licensesMonthly");
  const L = c("licensesAnnual");
  const O = c("claudeMonthly");
  const P = c("claudeAnnual");

  const v: ContractValues = {
    paymentType,
    licensesMonthlyCents: K,
    licensesAnnualOverrideCents: L !== null && !(K !== null && L === K * 12) ? L : null,
    taxOverrideCents: c("taxOverride"),
    claudeMonthlyCents: O,
    claudeAnnualOverrideCents: P !== null && !(O !== null && P === O * 12) ? P : null,
    iofOverrideCents: c("iofOverride"),
    licenseTotalOverrideCents: c("licenseTotalOverride"),
    supportCents: c("support") ?? 0,
    trainingCents: hasTraining ? (c("training") ?? 0) : 0,
    installments: installments ? Number(installments) || null : null,
    installmentOverrideCents: c("installmentOverride"),
    receivedCents: c("received") ?? 0,
    endAt: endAt || null,
  };
  const r = computeContract(v);

  const money2 = (f: MoneyField, label: string, opts?: { hint?: string; placeholder?: string; className?: string }) => (
    <Field label={label} htmlFor={`f-${f}`} hint={opts?.hint} error={errors?.[f]} className={opts?.className}>
      <MoneyInput
        id={`f-${f}`}
        name={f}
        placeholder={opts?.placeholder ?? "0,00"}
        value={m[f]}
        onChange={(e) => setM((s) => ({ ...s, [f]: e.target.value }))}
        aria-invalid={Boolean(errors?.[f])}
      />
    </Field>
  );

  const text = (name: string, label: string, opts?: { hint?: string; placeholder?: string; list?: string; type?: string; className?: string }) => (
    <Field label={label} htmlFor={`f-${name}`} hint={opts?.hint} error={errors?.[name]} className={opts?.className}>
      <Input
        id={`f-${name}`}
        name={name}
        type={opts?.type}
        list={opts?.list}
        placeholder={opts?.placeholder}
        defaultValue={values?.[name] ?? ((defaults as Record<string, unknown> | undefined)?.[name] as string | number | undefined)?.toString() ?? ""}
        aria-invalid={Boolean(errors?.[name])}
      />
    </Field>
  );

  const periodo = paymentType === "mensal" ? "por mês" : "no ano";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-7">
        <Section title="Contrato" cols="A · E · F · G · H · I · X">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("code", "ID / nº contrato", { placeholder: "EMPRESA260101CLAUDE" })}
            {text("description", "O que foi vendido", { list: "dl-products", placeholder: "Licenças Claude Team Standard" })}
            {text("quantity", "Quantidade de licenças", { type: "number", placeholder: "0" })}
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-mist/80">Modalidade (pagamento do cliente)</legend>
              <div className="inline-grid w-full grid-cols-2 rounded-lg border border-white/10 bg-abyss-deep/60 p-1 sm:w-auto" role="radiogroup">
                {(["mensal", "anual"] as const).map((t) => (
                  <label
                    key={t}
                    className={cn(
                      "relative flex h-8 cursor-pointer items-center justify-center rounded-md px-5 text-sm capitalize transition",
                      paymentType === t ? "text-abyss-deep" : "text-mist/60 hover:text-mist",
                    )}
                  >
                    {paymentType === t ? (
                      <motion.span layoutId="payment-pill" className="absolute inset-0 rounded-md bg-mist" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                    ) : null}
                    <input type="radio" name="paymentType" value={t} checked={paymentType === t} onChange={() => setPaymentType(t)} className="sr-only" />
                    <span className="relative font-medium">{t}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {text("signedAt", "Data da assinatura", { type: "date", hint: "Define o mês da meta" })}
            {text("startAt", "Início da vigência", { type: "date" })}
            <Field label="Fim da vigência" htmlFor="f-endAt" error={errors?.endAt} hint={r.daysToExpire !== null ? `${r.daysToExpire} dias até vencer` : undefined}>
              <Input id="f-endAt" name="endAt" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} aria-invalid={Boolean(errors?.endAt)} />
            </Field>
          </div>
        </Section>

        <Section title="Receita · cliente" cols="J · K · L">
          <div className="grid gap-4 sm:grid-cols-3">
            {money2("licensesMonthly", "Valor mensal (K)", { hint: "Valor das licenças por mês" })}
            {money2("licensesAnnual", "Valor anual (L)", {
              placeholder: K !== null ? centsToInput(K * 12) : "0,00",
              hint: "Vazio = mensal × 12",
            })}
            {money2("proposal2027Monthly", "Valor mensal 2027 (J)", { hint: "Proposta de renovação" })}
          </div>
        </Section>

        <Section title="Custo · Claude" cols="O · P">
          <div className="grid gap-4 sm:grid-cols-2">
            {money2("claudeMonthly", "Valor Claude mensal (O)", { hint: "Quanto pagamos à Claude por mês" })}
            {money2("claudeAnnual", "Valor licença anual (P)", {
              placeholder: O !== null ? centsToInput(O * 12) : "0,00",
              hint: "Vazio = Claude mensal × 12",
            })}
          </div>
        </Section>

        <Section title="Consultoria" cols="S">
          <div className="grid gap-4 sm:grid-cols-2">
            {money2("support", `Suporte (${periodo})`, {
              hint: paymentType === "mensal" ? "Entra na meta direto" : "Entra na meta ÷ 12",
            })}
            <div className="flex flex-col gap-1.5">
              <label className="flex h-[22px] cursor-pointer items-center justify-between gap-3 text-[13px] font-medium text-mist/80">
                Treinamento para liderança
                <span className="relative inline-flex">
                  <input type="checkbox" name="hasTraining" checked={hasTraining} onChange={(e) => setHasTraining(e.target.checked)} className="peer sr-only" />
                  <span className="h-5 w-9 rounded-full bg-white/10 transition peer-checked:bg-jelly-teal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-jelly-teal" />
                  <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-mist shadow transition peer-checked:translate-x-4" />
                </span>
              </label>
              <MoneyInput
                name="training"
                aria-label="Valor do treinamento"
                placeholder={hasTraining ? "Valor total" : "Não contratado"}
                disabled={!hasTraining}
                value={m.training}
                onChange={(e) => setM((s) => ({ ...s, training: e.target.value }))}
              />
              <p className="text-xs text-mist/40">Entra na meta ÷ 12</p>
            </div>
          </div>
        </Section>

        <Section title="Financeiro" cols="Y · Z · AA · AB">
          <div className="grid gap-4 sm:grid-cols-4">
            {text("paymentMethod", "Forma de pagamento", { list: "dl-payment" })}
            <Field label="Nº de parcelas" htmlFor="f-installments" error={errors?.installments} hint={`Vazio = ${paymentType === "anual" ? 1 : 12}`}>
              <Input id="f-installments" name="installments" type="number" min={1} value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder={paymentType === "anual" ? "1" : "12"} />
            </Field>
            {money2("installmentOverride", "Valor por parcela", { placeholder: centsToInput(Math.round(r.annual / r.installments)), hint: "Vazio = anual ÷ parcelas" })}
            {money2("received", "Valor recebido")}
          </div>
        </Section>

        <Section title="Status" cols="U · V · W · AG">
          <div className="grid gap-4 sm:grid-cols-2">
            {text("action", "Ação", { list: "dl-actions", placeholder: "OK - ENVIADO PROPOSTA 2027" })}
            {text("owner", "Responsável / observações")}
            <Field label="Faturamento" htmlFor="f-billing">
              <Select id="f-billing" name="billingStatus" defaultValue={values?.billingStatus ?? defaults?.billingStatus ?? "pendente"}>
                <option value="ok">OK</option>
                <option value="pendente">Pendente</option>
                <option value="valor_errado">Valor errado</option>
              </Select>
            </Field>
            <Field label="Licenças" htmlFor="f-license">
              <Select id="f-license" name="licenseStatus" defaultValue={values?.licenseStatus ?? defaults?.licenseStatus ?? "pendente"}>
                <option value="ok">OK</option>
                <option value="pendente">Pendente</option>
              </Select>
            </Field>
          </div>
        </Section>

        <div className="rounded-xl border border-white/[0.07]">
          <button
            type="button"
            onClick={() => setShowAdjust((s) => !s)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={showAdjust}
          >
            <span>
              <span className="block text-sm font-medium">Ajustes manuais · valores reais</span>
              <span className="block text-xs text-mist/45">Use quando o imposto, o IOF ou o total da licença forem diferentes da fórmula</span>
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-mist/50 transition", showAdjust && "rotate-180")} />
          </button>
          <div className={cn("grid gap-4 border-t border-white/[0.06] px-4 py-4 sm:grid-cols-3", !showAdjust && "hidden")}>
            {money2("taxOverride", "Imposto NF (M)", { placeholder: centsToInput(Math.round(r.annual * NF_TAX_RATE)), hint: `Vazio = L × ${pct(NF_TAX_RATE)}` })}
            {money2("iofOverride", "IOF (Q)", { placeholder: centsToInput(Math.round(r.claudeAnnual * IOF_RATE)), hint: `Vazio = P × ${pct(IOF_RATE)}` })}
            {money2("licenseTotalOverride", "Total licença (R)", { placeholder: "", hint: "Vazio = P + Q" })}
          </div>
        </div>

        <datalist id="dl-products">{PRODUCT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="dl-actions">{ACTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="dl-payment">{PAYMENT_METHOD_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </div>

      {/* Prévia: mesma conta da planilha */}
      <aside className="h-fit rounded-xl border border-jelly-teal/15 bg-gradient-to-b from-jelly-teal/[0.06] to-transparent p-5 xl:sticky xl:top-6">
        <p className="text-xs font-medium tracking-[0.16em] text-jelly-teal uppercase">Cálculo da planilha</p>
        <dl className="mt-4 grid gap-2 text-[13px]">
          <Row col="L" label="Valor anual" value={money(r.annual)} />
          <Row col="M" label={`Imposto NF ${pct(NF_TAX_RATE)}`} value={`− ${money(r.tax)}`} muted />
          <Row col="N" label="Líquido" value={money(r.net)} strong />
          <Divider />
          <Row col="P" label="Licença Claude anual" value={`− ${money(r.claudeAnnual)}`} muted />
          <Row col="Q" label={`IOF ${pct(IOF_RATE)}`} value={`− ${money(r.iof)}`} muted />
          <Row col="R" label="Total licença" value={`− ${money(r.licenseTotal)}`} />
          <Divider />
          <Row col="S" label="Consultoria" value={`+ ${money(r.consulting)}`} />
          <div className="mt-1 flex items-baseline justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5">
            <dt className="text-mist/70">
              <span className="mr-1.5 font-mono text-[10px] text-mist/35">T</span>Resultado
            </dt>
            <dd className={cn("tabular text-base font-semibold", r.result < 0 ? "text-danger" : "text-jelly-teal")}>{money(r.result)}</dd>
          </div>
          <p className="text-right text-[11px] text-mist/40">Margem {percent(r.margin)}</p>
          <Divider />
          <Row label="Soma na meta / mês" value={money(r.goalContribution)} strong />
          <Row col="AA" label={`${r.installments}× parcela`} value={money(r.installmentValue)} muted />
          <Row col="AC" label="Saldo a receber" value={money(r.balanceDue)} muted />
        </dl>
      </aside>
    </div>
  );
}

function Section({ title, cols, children }: { title: string; cols: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="font-mono text-[10px] tracking-wider text-mist/30" title="Colunas da planilha">
          {cols}
        </span>
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-white/[0.07]" />;
}

function Row({ col, label, value, strong, muted }: { col?: string; label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("min-w-0", muted ? "text-mist/45" : "text-mist/65")}>
        {col ? <span className="mr-1.5 inline-block w-5 font-mono text-[10px] text-mist/35">{col}</span> : null}
        {label}
      </dt>
      <dd className={cn("tabular shrink-0", strong ? "font-semibold text-mist" : muted ? "text-mist/55" : "text-mist/85")}>{value}</dd>
    </div>
  );
}
