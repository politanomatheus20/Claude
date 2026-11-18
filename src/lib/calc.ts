/**
 * Regras de negócio — réplica EXATA das fórmulas da planilha "CLAUDE DATAGROUP 2026".
 *
 * Funções puras, sem I/O. Entradas em centavos (inteiros). Os cálculos intermediários
 * NÃO são arredondados (igual ao Google Sheets); o arredondamento acontece só na exibição.
 *
 * Mapa de colunas (planilha → função):
 *   K  Valor Mensal (R$)       = valor digitado  | L ÷ 12
 *   L  Valor Anual (R$)        = K × 12          | valor digitado
 *   M  Imposto NF              = L × 12%         | valor digitado
 *   N  Valor Líquido           = L − M
 *   O  Valor Claude Mensal     = valor digitado
 *   P  Valor Licença Anual     = O × 12          | valor digitado
 *   Q  IOF                     = P × 3,5%        | valor digitado
 *   R  Total Licença           = P + Q           | valor digitado
 *   S  Consultoria             = suporte (anualizado) + treinamento
 *   T  Resultado               = N − R + S
 *   Z  Nº de parcelas          = digitado        | 12 (mensal) ou 1 (anual)
 *   AA Valor por parcela       = L ÷ Z           | valor digitado
 *   AC Saldo a receber         = AA × Z − AB
 *   AE Dias até vencer         = H − hoje
 *
 * Meta mensal (regra do negócio): soma APENAS a consultoria do mês —
 * suporte mensal (anual ÷ 12) + treinamento ÷ 12  ⇔  S ÷ 12.
 */

import type { PaymentType } from "./db/schema";

export const NF_TAX_RATE = 0.12;
export const IOF_RATE = 0.035;
const MONTHS = 12;

export interface ContractValues {
  paymentType: PaymentType;
  licensesMonthlyCents: number | null;
  licensesAnnualOverrideCents: number | null;
  taxOverrideCents: number | null;
  claudeMonthlyCents: number | null;
  claudeAnnualOverrideCents: number | null;
  iofOverrideCents: number | null;
  licenseTotalOverrideCents: number | null;
  supportCents: number;
  trainingCents: number;
  installments: number | null;
  installmentOverrideCents: number | null;
  receivedCents: number;
  endAt: string | null;
}

const n = (v: number | null | undefined) => v ?? 0;

/** L — Valor anual cobrado do cliente. */
export const annualValue = (c: ContractValues) => c.licensesAnnualOverrideCents ?? n(c.licensesMonthlyCents) * MONTHS;

/** K — Valor mensal cobrado do cliente. */
export const monthlyValue = (c: ContractValues) => c.licensesMonthlyCents ?? annualValue(c) / MONTHS;

/** M — Imposto da nota fiscal. */
export const nfTax = (c: ContractValues) => c.taxOverrideCents ?? annualValue(c) * NF_TAX_RATE;

/** N — Valor líquido. */
export const netValue = (c: ContractValues) => annualValue(c) - nfTax(c);

/** P — Custo anual da licença Claude. */
export const claudeAnnual = (c: ContractValues) => c.claudeAnnualOverrideCents ?? n(c.claudeMonthlyCents) * MONTHS;

/** Q — IOF sobre a licença. */
export const iof = (c: ContractValues) => c.iofOverrideCents ?? claudeAnnual(c) * IOF_RATE;

/** R — Total da licença (custo). */
export const licenseTotal = (c: ContractValues) => c.licenseTotalOverrideCents ?? claudeAnnual(c) + iof(c);

/** Suporte por mês: mensal = valor informado; anual = valor ÷ 12. */
export const monthlySupport = (c: Pick<ContractValues, "paymentType" | "supportCents">) =>
  c.paymentType === "anual" ? c.supportCents / MONTHS : c.supportCents;

/** Suporte no ano: mensal = valor × 12; anual = valor informado. */
export const annualSupport = (c: Pick<ContractValues, "paymentType" | "supportCents">) =>
  c.paymentType === "anual" ? c.supportCents : c.supportCents * MONTHS;

/** Treinamento para liderança diluído no mês. */
export const monthlyTraining = (c: Pick<ContractValues, "trainingCents">) => c.trainingCents / MONTHS;

/** S — Consultoria (suporte no ano + treinamento). */
export const consulting = (c: Pick<ContractValues, "paymentType" | "supportCents" | "trainingCents">) =>
  annualSupport(c) + c.trainingCents;

/** T — Resultado = N − R + S. */
export const result = (c: ContractValues) => netValue(c) - licenseTotal(c) + consulting(c);

/** Quanto o contrato soma na meta mensal (suporte/mês + treinamento ÷ 12 = S ÷ 12). */
export const goalContribution = (c: Pick<ContractValues, "paymentType" | "supportCents" | "trainingCents">) =>
  monthlySupport(c) + monthlyTraining(c);

/** Z — Nº de parcelas. */
export const installmentsOf = (c: Pick<ContractValues, "installments" | "paymentType">) =>
  c.installments ?? (c.paymentType === "anual" ? 1 : MONTHS);

/** AA — Valor por parcela. */
export const installmentValue = (c: ContractValues) =>
  c.installmentOverrideCents ?? annualValue(c) / installmentsOf(c);

/** AC — Saldo a receber. */
export const balanceDue = (c: ContractValues) => installmentValue(c) * installmentsOf(c) - c.receivedCents;

/** AE — Dias até vencer (null sem data de fim). */
export function daysToExpire(c: Pick<ContractValues, "endAt">, today = new Date()): number | null {
  if (!c.endAt) return null;
  const end = Date.UTC(+c.endAt.slice(0, 4), +c.endAt.slice(5, 7) - 1, +c.endAt.slice(8, 10));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - now) / 86_400_000);
}

export type TermStatus = "ativo" | "a_vencer" | "vencido" | "sem_data";
/** AD — Situação da vigência (a vencer = 60 dias ou menos). */
export function termStatus(c: Pick<ContractValues, "endAt">, today = new Date()): TermStatus {
  const d = daysToExpire(c, today);
  if (d === null) return "sem_data";
  if (d < 0) return "vencido";
  if (d <= 60) return "a_vencer";
  return "ativo";
}

export type FinancialStatus = "a_receber" | "recebido";
/** AF — Situação financeira. */
export const financialStatus = (c: ContractValues): FinancialStatus =>
  balanceDue(c) > 0.5 ? "a_receber" : "recebido";

/** Todas as colunas calculadas de um contrato, de uma vez. */
export function computeContract(c: ContractValues, today = new Date()) {
  const L = annualValue(c);
  const T = result(c);
  return {
    monthly: monthlyValue(c), // K
    annual: L, // L
    tax: nfTax(c), // M
    net: netValue(c), // N
    claudeAnnual: claudeAnnual(c), // P
    iof: iof(c), // Q
    licenseTotal: licenseTotal(c), // R
    consulting: consulting(c), // S
    result: T, // T
    margin: L > 0 ? T / L : null,
    installments: installmentsOf(c), // Z
    installmentValue: installmentValue(c), // AA
    balanceDue: balanceDue(c), // AC
    daysToExpire: daysToExpire(c, today), // AE
    termStatus: termStatus(c, today), // AD
    financialStatus: financialStatus(c), // AF
    goalContribution: goalContribution(c),
  };
}

export type ContractComputed = ReturnType<typeof computeContract>;

/** Soma colunas monetárias de vários contratos (linha de totais da planilha). */
export function sumComputed(rows: ReadonlyArray<ContractComputed>) {
  const keys = ["annual", "tax", "net", "claudeAnnual", "iof", "licenseTotal", "consulting", "result", "balanceDue", "goalContribution"] as const;
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>;
  for (const r of rows) for (const k of keys) out[k] += r[k];
  return out;
}

export interface GoalProgress {
  targetCents: number;
  achievedCents: number;
  remainingCents: number;
  remainingToHalfCents: number;
  ratio: number;
  rawRatio: number;
  exceededCents: number;
  reached: boolean;
  halfReached: boolean;
}

export function goalProgress(targetCents: number, contributions: ReadonlyArray<number>): GoalProgress {
  const achievedCents = contributions.reduce((s, c) => s + c, 0);
  const half = targetCents / 2;
  const rawRatio = targetCents > 0 ? achievedCents / targetCents : 0;
  return {
    targetCents,
    achievedCents,
    remainingCents: Math.max(0, targetCents - achievedCents),
    remainingToHalfCents: Math.max(0, half - achievedCents),
    ratio: Math.min(1, Math.max(0, rawRatio)),
    rawRatio,
    exceededCents: Math.max(0, achievedCents - targetCents),
    reached: targetCents > 0 && achievedCents >= targetCents,
    halfReached: targetCents > 0 && achievedCents >= half,
  };
}

/** Mês em que o contrato conta na meta: assinatura (F) ou, se não houver, início da vigência (G). */
export const goalMonthOf = (c: { signedAt: string | null; startAt: string | null }) =>
  (c.signedAt ?? c.startAt)?.slice(0, 7) ?? null;
