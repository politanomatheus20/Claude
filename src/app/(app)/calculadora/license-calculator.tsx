"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  ANNUAL_LICENSE_REFERENCE,
  MONTHLY_LICENSE_REFERENCE,
  computeAnnualLicenseRow,
  computeMonthlyLicenseRow,
  monthlySupportAddon,
  sumAnnualLicenseRows,
  sumMonthlyLicenseRows,
  type LicenseReference,
} from "@/lib/calc";
import { Stat } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { centsToInput, money, parseMoneyToCents, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "mensal" | "anual";

interface RowInputs {
  usdCost: string;
  fxRate: string;
  quantity: string;
  unitPrice: string;
  months: string;
  /** Ajuste manual — vazio = usa a fórmula (custo × câmbio + IOF). */
  licenseCostOverride: string;
  /** Ajuste manual — vazio = usa quantidade × valor unitário. */
  clientTotalOverride: string;
}

const emptyRow = (ref: LicenseReference): RowInputs => ({
  usdCost: "",
  fxRate: "5,00",
  quantity: "",
  unitPrice: centsToInput(ref.zeroMarginCents),
  months: "12",
  licenseCostOverride: "",
  clientTotalOverride: "",
});

const toCents = (v: string) => parseMoneyToCents(v) ?? 0;
/** Campos de ajuste manual: vazio = sem ajuste (usa a fórmula). */
const toOverrideCents = (v: string) => (v.trim() === "" ? null : parseMoneyToCents(v));
const toInt = (v: string) => {
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calculadora de proposta — réplica das abas "Mensal" e "Anual" de
 * Calculadora_De_Licencas.xlsx (lógica em src/lib/calc.ts). Ferramenta de
 * simulação: não lê nem grava nada no banco.
 */
export function LicenseCalculator() {
  const [mode, setMode] = useState<Mode>("mensal");
  const [months, setMonths] = useState("12");
  const [monthlyRows, setMonthlyRows] = useState<RowInputs[]>(() => MONTHLY_LICENSE_REFERENCE.map(emptyRow));
  const [annualRows, setAnnualRows] = useState<RowInputs[]>(() => ANNUAL_LICENSE_REFERENCE.map(emptyRow));

  const reference = mode === "mensal" ? MONTHLY_LICENSE_REFERENCE : ANNUAL_LICENSE_REFERENCE;
  const setRows = mode === "mensal" ? setMonthlyRows : setAnnualRows;

  function patch(index: number, field: keyof RowInputs, value: string) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function applyReference(index: number, cents: number) {
    setMonthlyRows((rs) => (mode === "mensal" ? rs.map((r, i) => (i === index ? { ...r, unitPrice: centsToInput(cents) } : r)) : rs));
    setAnnualRows((rs) => (mode === "anual" ? rs.map((r, i) => (i === index ? { ...r, unitPrice: centsToInput(cents) } : r)) : rs));
  }

  const monthlyComputed = useMemo(
    () =>
      monthlyRows.map((r, i) =>
        computeMonthlyLicenseRow(
          {
            name: MONTHLY_LICENSE_REFERENCE[i].name,
            usdCostCents: toCents(r.usdCost),
            fxRateCents: toCents(r.fxRate),
            quantity: toInt(r.quantity),
            unitPriceCents: toCents(r.unitPrice),
            licenseCostOverrideCents: toOverrideCents(r.licenseCostOverride),
            clientTotalOverrideCents: toOverrideCents(r.clientTotalOverride),
          },
          toInt(months) || 12,
        ),
      ),
    [monthlyRows, months],
  );

  const annualComputed = useMemo(
    () =>
      annualRows.map((r, i) =>
        computeAnnualLicenseRow({
          name: ANNUAL_LICENSE_REFERENCE[i].name,
          usdCostCents: toCents(r.usdCost),
          fxRateCents: toCents(r.fxRate),
          quantity: toInt(r.quantity),
          months: toInt(r.months) || 12,
          unitPriceCents: toCents(r.unitPrice),
          licenseCostOverrideCents: toOverrideCents(r.licenseCostOverride),
          clientTotalOverrideCents: toOverrideCents(r.clientTotalOverride),
        }),
      ),
    [annualRows],
  );

  const monthlyTotals = useMemo(() => sumMonthlyLicenseRows(monthlyComputed), [monthlyComputed]);
  const annualTotals = useMemo(() => sumAnnualLicenseRows(annualComputed), [annualComputed]);
  const totalQuantity = useMemo(() => monthlyRows.reduce((s, r) => s + toInt(r.quantity), 0), [monthlyRows]);
  const support = useMemo(() => monthlySupportAddon(totalQuantity), [totalQuantity]);
  const grandClientCents = monthlyTotals.clientTotalCents + support.supportCents;
  const grandResultCents = monthlyTotals.resultCents + support.netSupportCents;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-4">
        <Card className="animate-fade-up">
          <CardHeader
            title="Calculadora de proposta — licenças de IA"
            description="Custo em dólar → custo em reais (c/ IOF) → preço ao cliente → resultado e margem. Mesma lógica da planilha Calculadora_De_Licencas."
            action={<ModeToggle mode={mode} onChange={setMode} />}
          />

          {mode === "mensal" ? (
            <div className="flex items-center justify-end gap-2 px-5 pt-4 text-xs text-mist/50">
              <label htmlFor="calc-months">Meses de contrato (projeção)</label>
              <input
                id="calc-months"
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="h-8 w-14 rounded-md border border-white/10 bg-abyss-deep/60 px-2 text-right text-sm tabular text-mist outline-none focus:border-jelly-teal/60"
              />
            </div>
          ) : null}

          <div className="overflow-x-auto px-5 py-5">
            {mode === "mensal" ? (
              <MensalTable rows={monthlyRows} computed={monthlyComputed} totals={monthlyTotals} months={toInt(months) || 12} onPatch={patch} />
            ) : (
              <AnualTable rows={annualRows} computed={annualComputed} totals={annualTotals} onPatch={patch} />
            )}
          </div>

          {mode === "mensal" ? (
            <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] px-5 py-4 sm:grid-cols-4">
              <Stat label={`Suporte (${totalQuantity} licenças)`} value={money(support.supportCents)} hint={`líquido ${money(support.netSupportCents)}`} />
              <Stat label="Total cliente (c/ suporte)" value={money(grandClientCents)} />
              <Stat
                label="Resultado (c/ suporte)"
                value={money(grandResultCents)}
                tone={grandResultCents >= 0 ? "positive" : "negative"}
              />
              <Stat label="Margem geral" value={percent(grandClientCents > 0 ? grandResultCents / grandClientCents : null)} />
            </div>
          ) : null}
        </Card>
      </div>

      <ReferencePanel reference={reference} onApply={applyReference} />
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-grid grid-cols-2 rounded-lg border border-white/10 bg-abyss-deep/60 p-1" role="radiogroup" aria-label="Modo de cobrança">
      {(["mensal", "anual"] as const).map((t) => (
        <label
          key={t}
          className={cn(
            "relative flex h-8 cursor-pointer items-center justify-center rounded-md px-5 text-sm capitalize transition",
            mode === t ? "text-abyss-deep" : "text-mist/60 hover:text-mist",
          )}
        >
          {mode === t ? (
            <motion.span layoutId="calc-mode-pill" className="absolute inset-0 rounded-md bg-mist" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          ) : null}
          <input type="radio" name="calcMode" value={t} checked={mode === t} onChange={() => onChange(t)} className="sr-only" />
          <span className="relative font-medium">{t}</span>
        </label>
      ))}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  prefix,
  align = "right",
  placeholder,
  manual,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  align?: "right" | "center";
  placeholder?: string;
  /** Valor digitado à mão (substitui a fórmula) — mesmo destaque da Planilha. */
  manual?: boolean;
  title?: string;
}) {
  return (
    <div className="relative">
      {prefix ? <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-mist/40">{prefix}</span> : null}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={title}
        className={cn(
          "h-8 w-full min-w-[4.5rem] rounded-md border border-white/10 bg-abyss-deep/60 text-sm tabular outline-none transition placeholder:text-mist/25 focus:border-jelly-teal/60 focus:shadow-[0_0_0_2px_rgb(53_232_200/0.12)]",
          manual ? "text-warn" : "text-mist",
          prefix ? "pl-7 pr-2" : "px-2",
          align === "center" ? "text-center" : "text-right",
        )}
      />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-2 py-2 text-left font-medium whitespace-nowrap", className)}>{children}</th>;
}

function Td({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-2 py-2 align-middle", className)}>
      {children}
    </td>
  );
}

function ResultCell({ cents, hint }: { cents: number; hint?: string }) {
  return (
    <div className="text-right">
      <p className={cn("tabular font-medium", cents < 0 ? "text-danger" : "text-mist")}>{money(cents)}</p>
      {hint ? <p className="text-[11px] text-mist/40">{hint}</p> : null}
    </div>
  );
}

function MensalTable({
  rows,
  computed,
  totals,
  months,
  onPatch,
}: {
  rows: RowInputs[];
  computed: ReturnType<typeof computeMonthlyLicenseRow>[];
  totals: ReturnType<typeof sumMonthlyLicenseRows>;
  months: number;
  onPatch: (index: number, field: keyof RowInputs, value: string) => void;
}) {
  return (
    <table className="w-full min-w-[62rem] text-sm">
      <thead>
        <tr className="text-xs text-mist/45">
          <Th>Licença</Th>
          <Th>Custo US$</Th>
          <Th>Câmbio</Th>
          <Th className="text-right">Custo licença</Th>
          <Th className="text-center">Qtd</Th>
          <Th>Valor unitário</Th>
          <Th className="text-right">Total cliente</Th>
          <Th className="text-right">Resultado</Th>
          <Th className="text-right">Margem</Th>
          <Th className="text-right">Anual ({months}m)</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {rows.map((r, i) => {
          const c = computed[i];
          return (
            <tr key={MONTHLY_LICENSE_REFERENCE[i].name}>
              <Td className="font-medium whitespace-nowrap">{MONTHLY_LICENSE_REFERENCE[i].name}</Td>
              <Td>
                <NumInput value={r.usdCost} onChange={(v) => onPatch(i, "usdCost", v)} prefix="US$" />
              </Td>
              <Td>
                <NumInput value={r.fxRate} onChange={(v) => onPatch(i, "fxRate", v)} prefix="R$" />
              </Td>
              <Td>
                <NumInput
                  value={r.licenseCostOverride}
                  onChange={(v) => onPatch(i, "licenseCostOverride", v)}
                  prefix="R$"
                  placeholder={centsToInput(c.licenseCostCents)}
                  manual={r.licenseCostOverride.trim() !== ""}
                  title="Fórmula: custo × câmbio + IOF. Digite para fixar; apague para voltar à fórmula."
                />
                <p className="mt-0.5 text-[11px] text-mist/40">IOF {money(c.iofCents)}</p>
              </Td>
              <Td>
                <NumInput value={r.quantity} onChange={(v) => onPatch(i, "quantity", v)} align="center" />
              </Td>
              <Td>
                <NumInput value={r.unitPrice} onChange={(v) => onPatch(i, "unitPrice", v)} prefix="R$" />
              </Td>
              <Td>
                <NumInput
                  value={r.clientTotalOverride}
                  onChange={(v) => onPatch(i, "clientTotalOverride", v)}
                  prefix="R$"
                  placeholder={centsToInput(c.clientTotalCents)}
                  manual={r.clientTotalOverride.trim() !== ""}
                  title="Fórmula: quantidade × valor unitário. Digite para fixar; apague para voltar à fórmula."
                />
                <p className="mt-0.5 text-right text-[11px] text-mist/40">líq. {money(c.netTotalCents)}</p>
              </Td>
              <Td>
                <ResultCell cents={c.resultCents} hint={`custo ${money(c.totalCostCents)}`} />
              </Td>
              <Td className="text-right tabular">{percent(c.margin)}</Td>
              <Td className="text-right">
                <p className="tabular">{money(c.annualClientCents)}</p>
                <p className="text-[11px] text-mist/40">res. {money(c.annualResultCents)}</p>
              </Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-white/[0.08] font-medium">
          <Td colSpan={6} className="text-right text-xs text-mist/45">
            Total
          </Td>
          <Td className="text-right">
            <p className="tabular">{money(totals.clientTotalCents)}</p>
            <p className="text-[11px] font-normal text-mist/40">líq. {money(totals.netTotalCents)}</p>
          </Td>
          <Td>
            <ResultCell cents={totals.resultCents} hint={`custo ${money(totals.totalCostCents)}`} />
          </Td>
          <Td className="text-right tabular">{percent(totals.margin)}</Td>
          <Td className="text-right">
            <p className="tabular">{money(totals.annualClientCents)}</p>
            <p className="text-[11px] font-normal text-mist/40">res. {money(totals.annualResultCents)}</p>
          </Td>
        </tr>
      </tfoot>
    </table>
  );
}

function AnualTable({
  rows,
  computed,
  totals,
  onPatch,
}: {
  rows: RowInputs[];
  computed: ReturnType<typeof computeAnnualLicenseRow>[];
  totals: ReturnType<typeof sumAnnualLicenseRows>;
  onPatch: (index: number, field: keyof RowInputs, value: string) => void;
}) {
  return (
    <table className="w-full min-w-[62rem] text-sm">
      <thead>
        <tr className="text-xs text-mist/45">
          <Th>Licença</Th>
          <Th>Custo US$</Th>
          <Th>Câmbio</Th>
          <Th className="text-right">Custo licença</Th>
          <Th className="text-center">Meses</Th>
          <Th className="text-center">Qtd</Th>
          <Th>Valor unit. mensal</Th>
          <Th className="text-right">Total cliente (anual)</Th>
          <Th className="text-right">Resultado</Th>
          <Th className="text-right">Margem</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {rows.map((r, i) => {
          const c = computed[i];
          return (
            <tr key={ANNUAL_LICENSE_REFERENCE[i].name}>
              <Td className="font-medium whitespace-nowrap">{ANNUAL_LICENSE_REFERENCE[i].name}</Td>
              <Td>
                <NumInput value={r.usdCost} onChange={(v) => onPatch(i, "usdCost", v)} prefix="US$" />
              </Td>
              <Td>
                <NumInput value={r.fxRate} onChange={(v) => onPatch(i, "fxRate", v)} prefix="R$" />
              </Td>
              <Td>
                <NumInput
                  value={r.licenseCostOverride}
                  onChange={(v) => onPatch(i, "licenseCostOverride", v)}
                  prefix="R$"
                  placeholder={centsToInput(c.licenseCostCents)}
                  manual={r.licenseCostOverride.trim() !== ""}
                  title="Fórmula: custo × câmbio + IOF. Digite para fixar; apague para voltar à fórmula."
                />
                <p className="mt-0.5 text-[11px] text-mist/40">IOF {money(c.iofCents)}</p>
              </Td>
              <Td>
                <NumInput value={r.months} onChange={(v) => onPatch(i, "months", v)} align="center" />
              </Td>
              <Td>
                <NumInput value={r.quantity} onChange={(v) => onPatch(i, "quantity", v)} align="center" />
              </Td>
              <Td>
                <NumInput value={r.unitPrice} onChange={(v) => onPatch(i, "unitPrice", v)} prefix="R$" />
              </Td>
              <Td>
                <NumInput
                  value={r.clientTotalOverride}
                  onChange={(v) => onPatch(i, "clientTotalOverride", v)}
                  prefix="R$"
                  placeholder={centsToInput(c.clientAnnualCents)}
                  manual={r.clientTotalOverride.trim() !== ""}
                  title="Fórmula: valor unitário × meses × quantidade. Digite para fixar; apague para voltar à fórmula."
                />
                <p className="mt-0.5 text-right text-[11px] text-mist/40">líq. {money(c.netCents)}</p>
              </Td>
              <Td>
                <ResultCell cents={c.resultCents} hint={`custo ${money(c.totalCostCents)}`} />
              </Td>
              <Td className="text-right tabular">{percent(c.margin)}</Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-white/[0.08] font-medium">
          <Td colSpan={6} className="text-right text-xs text-mist/45">
            Total
          </Td>
          <Td className="text-right">
            <p className="tabular">{money(totals.clientAnnualCents)}</p>
            <p className="text-[11px] font-normal text-mist/40">líq. {money(totals.netCents)}</p>
          </Td>
          <Td>
            <ResultCell cents={totals.resultCents} hint={`custo ${money(totals.totalCostCents)}`} />
          </Td>
          <Td className="text-right tabular">{percent(totals.margin)}</Td>
        </tr>
      </tfoot>
    </table>
  );
}

function ReferencePanel({
  reference,
  onApply,
}: {
  reference: readonly LicenseReference[];
  onApply: (index: number, cents: number) => void;
}) {
  return (
    <div className="grid h-fit min-w-0 grid-cols-1 gap-4">
      <Card className="animate-fade-up [animation-delay:60ms]">
        <CardHeader title="Tabela de apoio" description="Referência fixa — zero margem (valor padrão da calculadora)" />
        <ul className="divide-y divide-white/[0.05] text-sm">
          {reference.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0 truncate">{r.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="tabular font-medium">{money(r.zeroMarginCents)}</span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onApply(i, r.zeroMarginCents)}>
                  Usar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="animate-fade-up [animation-delay:100ms]">
        <CardHeader title="Licitação" description="Tabela de apoio — preço de referência para editais" />
        <ul className="divide-y divide-white/[0.05] text-sm">
          {reference.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0 truncate text-mist/70">{r.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="tabular text-mist/70">{money(r.biddingCents)}</span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onApply(i, r.biddingCents)}>
                  Usar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="animate-fade-up px-5 py-4 text-xs text-mist/45 [animation-delay:140ms]">
        IOF 3,5% e imposto 12% já entram automaticamente no cálculo — igual à planilha. &ldquo;Usar&rdquo; preenche o valor unitário da licença correspondente.
      </Card>
    </div>
  );
}
