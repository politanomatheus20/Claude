"use client";

import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ANNUAL_LICENSE_REFERENCE,
  DEFAULT_FX_RATE_CENTS,
  IOF_RATE,
  LICENSE_CALC_MONTHS,
  MONTHLY_LICENSE_REFERENCE,
  NF_TAX_RATE,
  computeLicenseRow,
  licenseProposalSummary,
  sumLicenseRows,
  supportFeeFor,
  type LicenseCalcResult,
  type LicenseReference,
} from "@/lib/calc";
import { Stat } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { centsToInput, money, parseDecimal, parseMoneyToCents, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProposalBuilder } from "./proposal-builder";

type Mode = "mensal" | "anual";

/**
 * Entradas de uma linha. Os campos de custo (E, F, G) são "fórmula ou valor
 * digitado": null = usa a fórmula; texto = valor fixo que prevalece.
 */
interface RowInputs {
  usdCost: string; // C
  unitCost: string | null; // E — null = C × D
  iof: string | null; // F — null = E × 3,5%
  licenseCost: string | null; // G — null = E + F
  quantity: string; // H (laranja)
  unitPrice: string; // J (laranja)
}

type Field = keyof RowInputs;

/** Ao editar um campo de custo, os campos calculados a partir dele voltam à fórmula. */
const DOWNSTREAM: Partial<Record<Field, Field[]>> = {
  usdCost: ["unitCost", "iof", "licenseCost"],
  unitCost: ["iof", "licenseCost"],
  iof: ["licenseCost"],
};

const defaultRow = (ref: LicenseReference): RowInputs => ({
  usdCost: centsToInput(ref.usdCostCents),
  unitCost: ref.unitCostCents === null ? null : centsToInput(ref.unitCostCents),
  iof: null,
  licenseCost: null,
  quantity: "",
  unitPrice: centsToInput(ref.zeroMarginCents),
});

/** Valores em reais: nunca negativos (um "-" digitado por engano vira 0). */
const toCents = (v: string) => Math.max(0, parseMoneyToCents(v) ?? 0);
/**
 * Valor do dólar: até 4 casas (ex.: 5,4321 ou 5.4321), sem arredondar para centavos.
 * Aqui o ponto é SEMPRE decimal — câmbio nunca tem milhar ("5.432" = 5,432, não 5 mil).
 */
const toFxCents = (v: string) => {
  const t = v.trim();
  const n = /^\d+\.\d+$/.test(t) ? Number(t) : parseDecimal(t);
  return Math.max(0, n ?? 0) * 100;
};
/** Campo fórmula/valor: null ou vazio = fórmula. */
const toOverrideCents = (v: string | null) => {
  if (v === null || v.trim() === "") return null;
  const c = parseMoneyToCents(v);
  return c === null ? null : Math.max(0, c);
};
/** Quantidade de licenças: só inteiro ("1,5" ou "2.5" não viram 15/25 — arredonda para baixo). */
const toInt = (v: string) => {
  const n = parseDecimal(v);
  return n === null || n < 0 ? 0 : Math.floor(n);
};

const MODES = {
  mensal: { reference: MONTHLY_LICENSE_REFERENCE, months: 1 },
  anual: { reference: ANNUAL_LICENSE_REFERENCE, months: LICENSE_CALC_MONTHS },
} as const;

/**
 * Calculadora de proposta — réplica das abas "Mensal" e "Anual" de
 * Calculadora_De_Licencas (lógica em src/lib/calc.ts). Ferramenta de
 * simulação: não lê nem grava nada no banco.
 */
export function LicenseCalculator() {
  const [mode, setMode] = useState<Mode>("mensal");
  const [rowsByMode, setRowsByMode] = useState<Record<Mode, RowInputs[]>>(() => ({
    mensal: MONTHLY_LICENSE_REFERENCE.map(defaultRow),
    anual: ANNUAL_LICENSE_REFERENCE.map(defaultRow),
  }));

  /** Valor do dólar (D): um só por aba, vale para todas as licenças. */
  const [fxByMode, setFxByMode] = useState<Record<Mode, string>>(() => ({
    mensal: centsToInput(DEFAULT_FX_RATE_CENTS),
    anual: centsToInput(DEFAULT_FX_RATE_CENTS),
  }));

  const { reference, months } = MODES[mode];
  const rows = rowsByMode[mode];
  const fxRate = fxByMode[mode];
  const fxRateCents = toFxCents(fxRate);

  function updateRow(index: number, fn: (r: RowInputs) => RowInputs) {
    setRowsByMode((s) => ({ ...s, [mode]: s[mode].map((r, i) => (i === index ? fn(r) : r)) }));
  }

  function patch(index: number, field: Field, value: string | null) {
    updateRow(index, (r) => {
      let next: RowInputs = { ...r, [field]: value };
      for (const f of DOWNSTREAM[field] ?? []) next = { ...next, [f]: null };
      return next;
    });
  }

  /** Novo valor do dólar: o custo de todas as licenças volta à fórmula (C × D → IOF → custo). */
  function changeFx(value: string) {
    setFxByMode((s) => ({ ...s, [mode]: value }));
    setRowsByMode((s) => ({ ...s, [mode]: s[mode].map((r) => ({ ...r, unitCost: null, iof: null, licenseCost: null })) }));
  }

  function resetDefaults() {
    setRowsByMode((s) => ({ ...s, [mode]: reference.map(defaultRow) }));
    setFxByMode((s) => ({ ...s, [mode]: centsToInput(DEFAULT_FX_RATE_CENTS) }));
  }

  const computed = useMemo(
    () =>
      rows.map((r, i) =>
        computeLicenseRow(
          {
            name: reference[i].name,
            usdCostCents: toCents(r.usdCost),
            fxRateCents,
            unitCostOverrideCents: toOverrideCents(r.unitCost),
            iofOverrideCents: toOverrideCents(r.iof),
            licenseCostOverrideCents: toOverrideCents(r.licenseCost),
            quantity: toInt(r.quantity),
            unitPriceCents: toCents(r.unitPrice),
          },
          months,
        ),
      ),
    [rows, reference, months, fxRateCents],
  );

  const quantities = useMemo(() => rows.map((r) => toInt(r.quantity)), [rows]);
  const totals = useMemo(() => sumLicenseRows(computed, quantities), [computed, quantities]);
  /** Licenças da aba atual, para a proposta automatizada. */
  const proposalLicenses = useMemo(
    () => rows.map((r, i) => ({ name: reference[i].name, quantity: quantities[i], unitPriceCents: toCents(r.unitPrice) })),
    [rows, reference, quantities],
  );
  const summary = licenseProposalSummary(totals.clientTotalCents, totals.quantity, months);
  const period = mode === "mensal" ? "mensal" : "anual";

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="animate-fade-up min-w-0">
        <CardHeader
          title="Calculadora de proposta — licenças de IA"
          description={
            mode === "mensal"
              ? "Valores por mês. Mesma lógica da planilha Calculadora_De_Licencas."
              : `Valores de ${LICENSE_CALC_MONTHS} meses (mensal × ${LICENSE_CALC_MONTHS}). Mesma lógica da planilha Calculadora_De_Licencas.`
          }
          action={<ModeToggle mode={mode} onChange={setMode} />}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 text-xs text-mist/50">
          <label className="flex items-center gap-2 text-mist/70">
            Valor do dólar
            <NumInput value={fxRate} onChange={changeFx} prefix="R$" ariaLabel="Valor do dólar" title="Vale para todas as licenças desta aba. Aceita até 4 casas (ex.: 5,4321)." />
          </label>
          <Legend />
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={resetDefaults}>
            <RotateCcw className="size-3.5" aria-hidden />
            Restaurar padrões desta aba
          </Button>
        </div>

        <div className="overflow-x-auto px-3 py-4 sm:px-4">
          <CalcTable
            mode={mode}
            reference={reference}
            rows={rows}
            computed={computed}
            totals={totals}
            onPatch={patch}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-white/[0.06] px-5 py-4 sm:grid-cols-3">
          <Stat label={`Valor total cliente ${period}`} value={money(summary.clientTotalCents)} hint="somente licenças" />
          <Stat
            label={`Suporte ${period}`}
            value={money(summary.supportCents)}
            hint={`${totals.quantity} ${totals.quantity === 1 ? "licença" : "licenças"}${summary.supportCents === 0 ? " · a partir de 5" : ""}`}
          />
          <Stat label={`Total ${period} (licenças + suporte)`} value={money(summary.grandTotalCents)} tone="positive" />
        </div>
      </Card>

      <ReferencePanel reference={reference} onApply={(i, cents) => patch(i, "unitPrice", centsToInput(cents))} />

      <ProposalBuilder billing={mode} licenses={proposalLicenses} supportMonthlyCents={supportFeeFor(totals.quantity)} />
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

const ORANGE = "border-orange-400/50 bg-orange-400/10 focus:border-orange-300";
const YELLOW_CELL = "bg-yellow-300/[0.06]";
/** Nome da licença fixo à esquerda quando a tabela rola na horizontal. */
const STICKY = "sticky left-0 z-20 bg-abyss";

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-orange-400/60 bg-orange-400/30" /> preencher
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border border-white/15 bg-abyss-deep" /> fixo (editável)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-yellow-300/40" /> automático
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-warn">R$</span> valor digitado no lugar da fórmula
      </span>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  prefix,
  align = "right",
  title,
  size = "money",
  tone = "fixed",
  manual,
  ariaLabel,
  onBlur,
  prefixNode,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  prefix?: string;
  /** Substitui o prefixo (ex.: botão ↺ quando o valor foi digitado). */
  prefixNode?: React.ReactNode;
  align?: "right" | "center";
  title?: string;
  /** "money" cabe R$ 99.999,99; "small" para valores curtos (IOF); "short" para quantidade. */
  size?: "money" | "small" | "short";
  /** "input" = laranja (campo a preencher); "fixed" = valor fixo editável. */
  tone?: "input" | "fixed";
  /** Valor digitado no lugar da fórmula. */
  manual?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-fit">
      {prefixNode ??
        (prefix ? <span className="pointer-events-none absolute inset-y-0 left-1.5 z-10 flex items-center text-[10px] text-mist/45">{prefix}</span> : null)}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={onBlur}
        title={title}
        aria-label={ariaLabel}
        className={cn(
          "h-8 rounded-md border text-[13px] tabular outline-none transition focus:shadow-[0_0_0_2px_rgb(53_232_200/0.12)]",
          tone === "input" ? ORANGE : "border-white/10 bg-abyss-deep/60 focus:border-jelly-teal/60",
          manual ? "text-warn" : "text-mist",
          size === "short" ? "w-12" : size === "small" ? "w-[4.75rem]" : prefix === "US$" ? "w-[5.75rem]" : "w-[5.5rem]",
          prefix ? (prefix === "US$" ? "pr-1.5 pl-8" : "pr-1.5 pl-6") : "px-1.5",
          align === "center" ? "text-center" : "text-right",
        )}
      />
    </div>
  );
}

/**
 * Campo "fórmula ou valor": mostra sempre o valor em uso. Digitar fixa o valor
 * (destacado); o botão ↺ volta à fórmula.
 */
function FormulaInput({
  override,
  formulaCents,
  onChange,
  formula,
  ariaLabel,
  size,
}: {
  override: string | null;
  formulaCents: number;
  onChange: (v: string | null) => void;
  formula: string;
  ariaLabel: string;
  size?: "money" | "small";
}) {
  const manual = override !== null;
  return (
    <NumInput
      value={override ?? centsToInput(formulaCents)}
      onChange={(v) => onChange(v)}
      onBlur={() => {
        // Campo apagado ou inválido volta à fórmula ao sair.
        if (override !== null && toOverrideCents(override) === null) onChange(null);
      }}
      prefix="R$"
      prefixNode={
        manual ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Voltar ${ariaLabel} à fórmula`}
            title={`Voltar à fórmula (${formula})`}
            className="absolute inset-y-0 left-0.5 z-10 my-auto grid size-6 place-items-center rounded text-warn/80 transition hover:bg-white/10 hover:text-warn"
          >
            <RotateCcw className="size-3" aria-hidden />
          </button>
        ) : undefined
      }
      manual={manual}
      size={size}
      ariaLabel={ariaLabel}
      title={manual ? `Valor fixo. Fórmula: ${formula} (↺ volta à fórmula)` : `Fórmula: ${formula}. Digite para fixar outro valor.`}
    />
  );
}

function Th({ children, className, yellow }: { children: React.ReactNode; className?: string; yellow?: boolean }) {
  return (
    <th className={cn("px-1 py-2 text-right align-bottom font-medium leading-tight", yellow && "bg-yellow-300/[0.10] text-yellow-200/80", className)}>
      {children}
    </th>
  );
}

function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-1 py-2 align-top", className)}>
      {children}
    </td>
  );
}

/**
 * Estrutura única de toda célula: linha de altura fixa (campo ou valor) +
 * linha reservada para a observação — assim todos os campos ficam alinhados.
 */
function Slot({ children, hint, align = "start", title }: { children?: React.ReactNode; hint?: React.ReactNode; align?: "start" | "center" | "end"; title?: string }) {
  const justify = align === "end" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "justify-start text-left";
  return (
    <div className="whitespace-nowrap">
      <div className={cn("flex h-8 items-center", justify)}>{children}</div>
      <p className={cn("mt-0.5 h-4 text-[11px] leading-4 font-normal text-mist/40", justify)} title={title}>
        {hint}
      </p>
    </div>
  );
}

function MoneyCell({ cents, hint, strong, signed }: { cents: number; hint?: string; strong?: boolean; signed?: boolean }) {
  return (
    <Slot align="end" hint={hint}>
      <span className={cn("tabular", strong && "font-medium", signed && cents < 0 ? "text-danger" : "text-mist")}>{money(cents)}</span>
    </Slot>
  );
}

function CalcTable({
  mode,
  reference,
  rows,
  computed,
  totals,
  onPatch,
}: {
  mode: Mode;
  reference: readonly LicenseReference[];
  rows: RowInputs[];
  computed: LicenseCalcResult[];
  totals: ReturnType<typeof sumLicenseRows>;
  onPatch: (index: number, field: Field, value: string | null) => void;
}) {
  const anual = mode === "anual";
  const tax = `${Math.round(NF_TAX_RATE * 100)}%`;
  const iofPct = `${(IOF_RATE * 100).toLocaleString("pt-BR")}%`;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-mist/45">
          <Th className={cn("text-left", STICKY)}>Licença</Th>
          <Th className="text-left">Custo dólar</Th>
          <Th className="text-left">Valor unit.</Th>
          <Th className="text-left">IOF</Th>
          <Th className="text-left">Custo licença</Th>
          <Th className="text-center">Qtd</Th>
          <Th className="text-left">Valor unitário{anual ? " (mês)" : ""}</Th>
          <Th yellow>Valor total cliente {anual ? "anual" : "mensal"}</Th>
          <Th yellow>Valor líquido <span className="font-normal opacity-70">(−{tax})</span></Th>
          <Th yellow>Resultado</Th>
          <Th>Margem</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.05]">
        {rows.map((r, i) => {
          const c = computed[i];
          const name = reference[i].name;
          return (
            <tr key={name}>
              <Td className={cn("min-w-[6rem]", STICKY)}>
                <div className="flex h-8 items-center text-[13px] leading-tight font-medium">{name}</div>
              </Td>
              <Td>
                <Slot>
                  <NumInput value={r.usdCost} onChange={(v) => onPatch(i, "usdCost", v)} prefix="US$" ariaLabel={`Custo dólar ${name}`} />
                </Slot>
              </Td>
              <Td>
                <Slot>
                <FormulaInput
                  override={r.unitCost}
                  formulaCents={c.unitCostCents}
                  onChange={(v) => onPatch(i, "unitCost", v)}
                  formula="custo dólar × valor do dólar"
                  ariaLabel={`Valor unitário em reais ${name}`}
                />
                </Slot>
              </Td>
              <Td>
                <Slot>
                <FormulaInput
                  override={r.iof}
                  formulaCents={c.iofCents}
                  onChange={(v) => onPatch(i, "iof", v)}
                  formula={`valor unit. × ${iofPct}`}
                  size="small"
                  ariaLabel={`IOF ${name}`}
                />
                </Slot>
              </Td>
              <Td>
                <Slot
                  hint={`total ${money(c.totalCostCents)}`}
                  title={`Total custo${anual ? ` (${LICENSE_CALC_MONTHS} meses)` : ""}`}
                >
                <FormulaInput
                  override={r.licenseCost}
                  formulaCents={c.licenseCostCents}
                  onChange={(v) => onPatch(i, "licenseCost", v)}
                  formula="valor unit. + IOF"
                  ariaLabel={`Custo da licença ${name}`}
                />
                </Slot>
              </Td>
              <Td>
                <Slot align="center">
                <NumInput
                  value={r.quantity}
                  onChange={(v) => onPatch(i, "quantity", v)}
                  align="center"
                  size="short"
                  tone="input"
                  ariaLabel={`Quantidade ${name}`}
                />
                </Slot>
              </Td>
              <Td>
                <Slot hint={`líq. ${money(c.netUnitCents)}`}>
                  <NumInput value={r.unitPrice} onChange={(v) => onPatch(i, "unitPrice", v)} prefix="R$" tone="input" ariaLabel={`Valor unitário ao cliente ${name}`} />
                </Slot>
              </Td>
              <Td className={YELLOW_CELL}>
                <MoneyCell cents={c.clientTotalCents} strong />
              </Td>
              <Td className={YELLOW_CELL}>
                <MoneyCell cents={c.netTotalCents} hint={`imp. ${money(c.taxCents)}`} />
              </Td>
              <Td className={YELLOW_CELL}>
                <MoneyCell cents={c.resultCents} strong signed />
              </Td>
              <Td>
                <Slot align="end">
                  <span className="tabular">{percent(c.margin)}</span>
                </Slot>
              </Td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-white/[0.08] font-medium">
          <Td className={STICKY}>
            <Slot>
              <span className="text-xs text-mist/45">Total {anual ? "anual" : "mensal"}</span>
            </Slot>
          </Td>
          <Td colSpan={4}>
            <Slot align="end">
              <span className="mr-1 text-[11px] font-normal text-mist/40">custo total</span>
              <span className="tabular">{money(totals.totalCostCents)}</span>
            </Slot>
          </Td>
          <Td>
            <Slot align="center">
              <span className="tabular">{totals.quantity}</span>
            </Slot>
          </Td>
          <Td />
          <Td className={YELLOW_CELL}>
            <MoneyCell cents={totals.clientTotalCents} strong />
          </Td>
          <Td className={YELLOW_CELL}>
            <MoneyCell cents={totals.netTotalCents} hint={`imp. ${money(totals.taxCents)}`} />
          </Td>
          <Td className={YELLOW_CELL}>
            <MoneyCell cents={totals.resultCents} strong signed />
          </Td>
          <Td>
            <Slot align="end">
              <span className="tabular">{percent(totals.margin)}</span>
            </Slot>
          </Td>
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
    <div className="grid h-fit min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card className="animate-fade-up [animation-delay:60ms]">
        <CardHeader title="Tabela de apoio" description="Referência fixa — zero margem (valor padrão da calculadora)" />
        <ul className="divide-y divide-white/[0.05] text-sm">
          {reference.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0 break-words">{r.name}</span>
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
        <CardHeader title="Licitação - 20%" description="Tabela de apoio — preço de referência para editais" />
        <ul className="divide-y divide-white/[0.05] text-sm">
          {reference.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0 break-words text-mist/70">{r.name}</span>
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
        IOF 3,5% e imposto 12% entram automaticamente. A margem é calculada só sobre as licenças — o suporte não entra.
        &ldquo;Usar&rdquo; preenche o valor unitário da licença correspondente.
      </Card>
    </div>
  );
}
