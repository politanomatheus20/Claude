"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { contractRevenue, goalContribution, monthlySupport, monthlyTraining } from "@/lib/calc";
import type { PaymentType } from "@/lib/db/schema";
import { centsToInput, money, parseMoneyToCents } from "@/lib/format";
import type { FieldErrors } from "@/lib/validation";
import { Field, MoneyInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface ProposalDefaults {
  paymentType?: PaymentType;
  licensesCents?: number;
  supportCents?: number;
  trainingCents?: number;
}

/**
 * Campos da proposta + prévia ao vivo do cálculo (mesmas funções de src/lib/calc.ts
 * usadas no servidor, então a prévia é exatamente o que será gravado).
 */
export function ProposalFields({
  defaults,
  values,
  errors,
}: {
  defaults?: ProposalDefaults;
  values?: Record<string, string>;
  errors?: FieldErrors;
}) {
  const init = (key: string, cents?: number) => values?.[key] ?? (cents ? centsToInput(cents) : "");

  const [paymentType, setPaymentType] = useState<PaymentType>(
    (values?.paymentType as PaymentType) ?? defaults?.paymentType ?? "mensal",
  );
  const [licenses, setLicenses] = useState(init("licenses", defaults?.licensesCents));
  const [support, setSupport] = useState(init("support", defaults?.supportCents));
  const [hasTraining, setHasTraining] = useState(
    values ? values.hasTraining === "on" : Boolean(defaults?.trainingCents),
  );
  const [training, setTraining] = useState(init("training", defaults?.trainingCents));

  const p = {
    paymentType,
    licensesCents: parseMoneyToCents(licenses) ?? 0,
    supportCents: parseMoneyToCents(support) ?? 0,
    trainingCents: hasTraining ? (parseMoneyToCents(training) ?? 0) : 0,
  };
  const period = paymentType === "mensal" ? "por mês" : "valor anual";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid gap-5">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-mist/80">Pagamento do cliente</legend>
          <div className="inline-grid grid-cols-2 rounded-lg border border-white/10 bg-abyss-deep/60 p-1" role="radiogroup">
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
                <input
                  type="radio"
                  name="paymentType"
                  value={t}
                  checked={paymentType === t}
                  onChange={() => setPaymentType(t)}
                  className="sr-only"
                />
                <span className="relative font-medium">{t}</span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-mist/40">
            {paymentType === "mensal"
              ? "Licenças e suporte informados como valor mensal."
              : "Parcela única: informe o valor anual de licenças e suporte."}
          </p>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={`Valor das licenças (${period})`} htmlFor="licenses" error={errors?.licenses}>
            <MoneyInput
              id="licenses"
              name="licenses"
              placeholder="0,00"
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              aria-invalid={Boolean(errors?.licenses)}
            />
          </Field>
          <Field label={`Valor do suporte (${period})`} htmlFor="support" error={errors?.support}>
            <MoneyInput
              id="support"
              name="support"
              placeholder="0,00"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              aria-invalid={Boolean(errors?.support)}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Treinamento para liderança</span>
              <span className="block text-xs text-mist/45">Fechou treinamento? Entra na meta dividido por 12.</span>
            </span>
            <span className="relative inline-flex">
              <input
                type="checkbox"
                name="hasTraining"
                checked={hasTraining}
                onChange={(e) => setHasTraining(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-10 rounded-full bg-white/10 transition peer-checked:bg-jelly-teal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-jelly-teal" />
              <span className="absolute top-1 left-1 size-4 rounded-full bg-mist shadow transition peer-checked:translate-x-4" />
            </span>
          </label>
          <AnimatePresence initial={false}>
            {hasTraining ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Field label="Valor do treinamento (total)" htmlFor="training" error={errors?.training} className="pt-4">
                  <MoneyInput
                    id="training"
                    name="training"
                    placeholder="0,00"
                    value={training}
                    onChange={(e) => setTraining(e.target.value)}
                    aria-invalid={Boolean(errors?.training)}
                  />
                </Field>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-jelly-teal/15 bg-gradient-to-b from-jelly-teal/[0.06] to-transparent p-5 lg:sticky lg:top-6">
        <p className="text-xs font-medium tracking-[0.16em] text-jelly-teal uppercase">Prévia do cálculo</p>
        <dl className="mt-4 grid gap-2.5 text-sm">
          <Row label={paymentType === "anual" ? "Suporte ÷ 12" : "Suporte mensal"} value={money(monthlySupport(p))} />
          <Row label="Treinamento ÷ 12" value={p.trainingCents ? money(monthlyTraining(p)) : "—"} />
          <div className="my-1 h-px bg-white/[0.08]" />
          <Row label="Soma na meta / mês" value={money(goalContribution(p))} strong />
          <Row label="Receita do contrato (12m)" value={money(contractRevenue(p))} muted />
        </dl>
      </aside>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("min-w-0", muted ? "text-mist/40" : "text-mist/60")}>{label}</dt>
      <dd className={cn("tabular shrink-0", strong ? "text-base font-semibold text-jelly-teal" : muted ? "text-mist/50" : "")}>{value}</dd>
    </div>
  );
}
