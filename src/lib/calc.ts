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
  /** S digitado à mão (ex.: na Planilha). Vazio = suporte no ano + treinamento. */
  consultingOverrideCents?: number | null;
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
export const consulting = (c: Pick<ContractValues, "paymentType" | "supportCents" | "trainingCents" | "consultingOverrideCents">) =>
  c.consultingOverrideCents ?? annualSupport(c) + c.trainingCents;

/** T — Resultado = N − R + S. */
export const result = (c: ContractValues) => netValue(c) - licenseTotal(c) + consulting(c);

/** Quanto o contrato soma na meta mensal: S ÷ 12 (= suporte/mês + treinamento ÷ 12). */
export const goalContribution = (c: Pick<ContractValues, "paymentType" | "supportCents" | "trainingCents" | "consultingOverrideCents">) =>
  c.consultingOverrideCents != null ? c.consultingOverrideCents / MONTHS : monthlySupport(c) + monthlyTraining(c);

/** Z — Nº de parcelas. */
export const installmentsOf = (c: Pick<ContractValues, "installments" | "paymentType">) =>
  c.installments ?? (c.paymentType === "anual" ? 1 : MONTHS);

/** AA — Valor por parcela. */
export const installmentValue = (c: ContractValues) =>
  c.installmentOverrideCents ?? annualValue(c) / installmentsOf(c);

/** AC — Saldo a receber. */
export const balanceDue = (c: ContractValues) => installmentValue(c) * installmentsOf(c) - c.receivedCents;

/** Data de hoje no fuso de Brasília (o servidor pode estar em UTC). */
export function todayInBrazil(): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { y, m, d };
}

/** AE — Dias até vencer (null sem data de fim). */
export function daysToExpire(c: Pick<ContractValues, "endAt">, today?: Date): number | null {
  if (!c.endAt) return null;
  const end = Date.UTC(+c.endAt.slice(0, 4), +c.endAt.slice(5, 7) - 1, +c.endAt.slice(8, 10));
  const t = today ? { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() } : todayInBrazil();
  const now = Date.UTC(t.y, t.m - 1, t.d);
  return Math.round((end - now) / 86_400_000);
}

export type TermStatus = "ativo" | "a_vencer" | "vencido" | "sem_data";
/** AD — Situação da vigência (a vencer = 60 dias ou menos). */
export function termStatus(c: Pick<ContractValues, "endAt">, today?: Date): TermStatus {
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
export function computeContract(c: ContractValues, today?: Date) {
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

/**
 * Calculadora de Proposta — Licenças de IA.
 * Réplica das abas "Mensal" e "Anual" de "Calculadora_De_Licencas (1).xlsx".
 * Ferramenta de simulação (não persiste no banco); valores em centavos, sem
 * arredondamento intermediário (arredonda só na exibição, como o Excel).
 *
 * Por linha de licença:
 *   C  Custo dólar        fixo editável
 *   D  Valor do dólar     fixo editável
 *   E  Valor unit. (R$)   = C × D            | valor fixo/digitado
 *   F  IOF                = E × 3,5%         | valor digitado
 *   G  Custo licença      = E + F            | valor digitado
 *   H  Quantidade         ENTRADA (laranja)
 *   J  Valor unitário     ENTRADA (laranja) — preço mensal por licença ao cliente
 * Mensal:  I = G × H · K = J × 12% · L = J − K · M = H × J · N = H × L · O = N − I · P = O ÷ M
 * Anual:   tudo × 12 meses (custo, valor cliente, líquido e resultado).
 * Margem = resultado ÷ valor cliente, só das licenças (o suporte não entra).
 */

/** O anual é sempre 12 meses. */
export const LICENSE_CALC_MONTHS = 12;

export interface LicenseReference {
  name: string;
  /** Custo em dólar padrão (C), em centavos de dólar. */
  usdCostCents: number;
  /** Valor unitário em reais padrão (E). null = fórmula C × D. */
  unitCostCents: number | null;
  /** Preço de referência fixo, sem margem — usado como valor unitário padrão. */
  zeroMarginCents: number;
  /** Preço de referência para licitação/edital — tabela de apoio à parte. */
  biddingCents: number;
}

/** Valor do dólar padrão (D) da planilha, em centavos. */
export const DEFAULT_FX_RATE_CENTS = 5_00;

/** Aba "Mensal" (valores padrão da planilha + tabelas de apoio, por licença/mês). */
export const MONTHLY_LICENSE_REFERENCE: readonly LicenseReference[] = [
  { name: "Claude Team Standard", usdCostCents: 25_00, unitCostCents: 138_00, zeroMarginCents: 171_00, biddingCents: 210_00 },
  { name: "Claude Team Premium", usdCostCents: 125_00, unitCostCents: 688_00, zeroMarginCents: 849_00, biddingCents: 990_00 },
  { name: "ChatGPT Business", usdCostCents: 20_00, unitCostCents: null, zeroMarginCents: 168_00, biddingCents: 168_00 },
];

/** Aba "Anual" (valores padrão da planilha + tabelas de apoio, equivalente mensal). */
export const ANNUAL_LICENSE_REFERENCE: readonly LicenseReference[] = [
  { name: "Claude Team Standard", usdCostCents: 25_00, unitCostCents: 110_00, zeroMarginCents: 136_00, biddingCents: 171_00 },
  { name: "Claude Team Premium", usdCostCents: 125_00, unitCostCents: 550_00, zeroMarginCents: 689_00, biddingCents: 854_00 },
  { name: "ChatGPT Business", usdCostCents: 20_00, unitCostCents: null, zeroMarginCents: 168_00, biddingCents: 168_00 },
];

/**
 * Suporte mensal: taxa fixa pela quantidade TOTAL de licenças (todas as linhas),
 * faixas por volume.
 */
export const SUPPORT_FEE_TIERS: readonly { minQuantity: number; cents: number }[] = [
  { minQuantity: 51, cents: 4_500_00 },
  { minQuantity: 41, cents: 2_800_00 },
  { minQuantity: 21, cents: 1_500_00 },
  { minQuantity: 11, cents: 990_00 },
  { minQuantity: 5, cents: 490_00 },
];

/** Taxa de suporte mensal para a quantidade total de licenças (0 abaixo de 5). */
export function supportFeeFor(totalQuantity: number) {
  return SUPPORT_FEE_TIERS.find((t) => totalQuantity >= t.minQuantity)?.cents ?? 0;
}

export interface LicenseCalcRowInput {
  name: string;
  /** Custo em dólar (C), em centavos de dólar. */
  usdCostCents: number;
  /** Valor do dólar (D), em centavos (ex.: 520 = R$ 5,20; aceita fração). */
  fxRateCents: number;
  /** Valor unitário em reais (E) fixo/digitado — null/ausente usa C × D. */
  unitCostOverrideCents?: number | null;
  /** IOF (F) digitado — null/ausente usa E × 3,5%. */
  iofOverrideCents?: number | null;
  /** Custo da licença (G) digitado — null/ausente usa E + F. */
  licenseCostOverrideCents?: number | null;
  /** Quantidade de licenças (H). */
  quantity: number;
  /** Valor unitário mensal cobrado do cliente (J), em centavos. */
  unitPriceCents: number;
}

/** E, F, G — custo da licença em reais, cada etapa com ajuste manual opcional. */
export function licenseCostOf(row: LicenseCalcRowInput) {
  const unitCostCents = row.unitCostOverrideCents ?? (row.usdCostCents * row.fxRateCents) / 100; // E
  const iofCents = row.iofOverrideCents ?? unitCostCents * IOF_RATE; // F
  const licenseCostCents = row.licenseCostOverrideCents ?? unitCostCents + iofCents; // G
  return { unitCostCents, iofCents, licenseCostCents };
}

/**
 * Uma linha da calculadora. `months` = 1 (aba Mensal) ou 12 (aba Anual):
 * custo, valor cliente, líquido e resultado são multiplicados por `months`.
 */
export function computeLicenseRow(row: LicenseCalcRowInput, months: number) {
  const { unitCostCents, iofCents, licenseCostCents } = licenseCostOf(row);
  const q = row.quantity;
  const totalCostCents = licenseCostCents * q * months; // I (mensal) · J (anual)
  const taxUnitCents = row.unitPriceCents * NF_TAX_RATE; // K
  const netUnitCents = row.unitPriceCents - taxUnitCents; // L
  const clientTotalCents = q * row.unitPriceCents * months; // M (mensal) · N (anual)
  const taxCents = clientTotalCents * NF_TAX_RATE; // imposto 12% sobre o total
  const netTotalCents = clientTotalCents - taxCents; // N (mensal) · P (anual)
  const resultCents = q === 0 ? 0 : netTotalCents - totalCostCents; // O (mensal) · Q (anual)
  const margin = q === 0 || clientTotalCents === 0 ? null : resultCents / clientTotalCents; // P · R
  return {
    unitCostCents,
    iofCents,
    licenseCostCents,
    totalCostCents,
    taxUnitCents,
    netUnitCents,
    clientTotalCents,
    taxCents,
    netTotalCents,
    resultCents,
    margin,
  };
}

export type LicenseCalcResult = ReturnType<typeof computeLicenseRow>;

/** Linha de totais (soma as linhas; margem = resultado ÷ valor cliente, sem suporte). */
export function sumLicenseRows(rows: ReadonlyArray<LicenseCalcResult>, quantities: ReadonlyArray<number>) {
  const sum = (k: "totalCostCents" | "clientTotalCents" | "taxCents" | "netTotalCents" | "resultCents") =>
    rows.reduce((s, r) => s + r[k], 0);
  const clientTotalCents = sum("clientTotalCents");
  const resultCents = sum("resultCents");
  return {
    quantity: quantities.reduce((s, n) => s + n, 0),
    totalCostCents: sum("totalCostCents"),
    clientTotalCents,
    taxCents: sum("taxCents"),
    netTotalCents: sum("netTotalCents"),
    resultCents,
    margin: clientTotalCents === 0 ? null : resultCents / clientTotalCents,
  };
}

/**
 * Indicadores: valor total cliente, suporte (pela quantidade total de licenças)
 * e a soma dos dois — no período (`months` = 1 mensal, 12 anual).
 */
export function licenseProposalSummary(clientTotalCents: number, totalQuantity: number, months: number) {
  const supportCents = supportFeeFor(totalQuantity) * months;
  return { clientTotalCents, supportCents, grandTotalCents: clientTotalCents + supportCents };
}
