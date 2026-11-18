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
 * Réplica EXATA das abas "Mensal" e "Anual" de "Calculadora_De_Licencas.xlsx".
 * Ferramenta de simulação (não persiste no banco); valores em centavos.
 */

export interface LicenseReference {
  name: string;
  /** Preço de referência fixo, sem margem — usado como valor unitário padrão. */
  zeroMarginCents: number;
  /** Preço de referência para licitação/edital — tabela de apoio à parte. */
  biddingCents: number;
}

/** Tabelas de apoio da aba "Mensal" (preço por licença, por mês). */
export const MONTHLY_LICENSE_REFERENCE: readonly LicenseReference[] = [
  { name: "Claude Team Standard", zeroMarginCents: 171_00, biddingCents: 210_00 },
  { name: "Claude Team Premium", zeroMarginCents: 849_00, biddingCents: 990_00 },
  { name: "ChatGPT Business", zeroMarginCents: 168_00, biddingCents: 168_00 },
];

/** Tabelas de apoio da aba "Anual" (preço por licença, equivalente mensal). */
export const ANNUAL_LICENSE_REFERENCE: readonly LicenseReference[] = [
  { name: "Claude Team Standard", zeroMarginCents: 136_00, biddingCents: 171_00 },
  { name: "Claude Team Premium", zeroMarginCents: 689_00, biddingCents: 854_00 },
  { name: "ChatGPT Business", zeroMarginCents: 168_00, biddingCents: 168_00 },
];

/**
 * Suporte mensal: taxa fixa pela quantidade TOTAL de licenças (todas as linhas),
 * não mais 30% do valor — faixas por volume.
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
  /** Câmbio (D), em centavos (ex.: 520 = R$ 5,20). */
  fxRateCents: number;
  /** Quantidade de licenças (H / I). */
  quantity: number;
  /** Valor unitário cobrado do cliente (J / L), em centavos. */
  unitPriceCents: number;
  /** Ajuste manual do custo da licença (G) — null/ausente usa a fórmula custo × câmbio + IOF. */
  licenseCostOverrideCents?: number | null;
  /** Ajuste manual do total cobrado do cliente — null/ausente usa quantidade × valor unitário. */
  clientTotalOverrideCents?: number | null;
}

/** E — Valor unitário em reais = custo dólar × câmbio. */
const unitCostOf = (row: LicenseCalcRowInput) => (row.usdCostCents * row.fxRateCents) / 100;

export type MonthlyLicenseCalcRow = LicenseCalcRowInput;

/** Linha da aba "Mensal": custo → IOF → custo total → resultado/margem mensal e anual. */
export function computeMonthlyLicenseRow(row: MonthlyLicenseCalcRow, months: number) {
  const unitCostCents = unitCostOf(row); // E
  const iofCents = unitCostCents * IOF_RATE; // F
  const licenseCostCents = row.licenseCostOverrideCents ?? unitCostCents + iofCents; // G · ou ajuste manual
  const totalCostCents = licenseCostCents * row.quantity; // I
  const taxCents = row.unitPriceCents * NF_TAX_RATE; // K
  const netUnitCents = row.unitPriceCents - taxCents; // L
  const manualTotal = row.clientTotalOverrideCents != null;
  const clientTotalCents = row.clientTotalOverrideCents ?? row.quantity * row.unitPriceCents; // M · ou ajuste manual
  const netTotalCents = manualTotal ? clientTotalCents - clientTotalCents * NF_TAX_RATE : row.quantity * netUnitCents; // N
  const zero = row.quantity === 0 && !manualTotal;
  const resultCents = zero ? 0 : netTotalCents - totalCostCents; // O
  const margin = zero || clientTotalCents === 0 ? null : resultCents / clientTotalCents; // P
  const annualClientCents = zero ? 0 : clientTotalCents * months; // Q
  const annualResultCents = resultCents * months; // R
  return {
    unitCostCents,
    iofCents,
    licenseCostCents,
    totalCostCents,
    taxCents,
    netUnitCents,
    clientTotalCents,
    netTotalCents,
    resultCents,
    margin,
    annualClientCents,
    annualResultCents,
  };
}

export type MonthlyLicenseCalcResult = ReturnType<typeof computeMonthlyLicenseRow>;

/** Linha de totais da aba "Mensal" (soma as linhas de licenças). */
export function sumMonthlyLicenseRows(rows: ReadonlyArray<MonthlyLicenseCalcResult>) {
  const sum = (k: keyof MonthlyLicenseCalcResult) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const totalCostCents = sum("totalCostCents");
  const clientTotalCents = sum("clientTotalCents");
  const netTotalCents = sum("netTotalCents");
  const resultCents = sum("resultCents");
  const annualClientCents = sum("annualClientCents");
  const annualResultCents = sum("annualResultCents");
  return {
    totalCostCents,
    clientTotalCents,
    netTotalCents,
    resultCents,
    annualClientCents,
    annualResultCents,
    margin: clientTotalCents === 0 ? null : resultCents / clientTotalCents,
  };
}

/** "Suporte": taxa fixa pela quantidade total de licenças, líquida do imposto — soma no resultado e no total cobrado. */
export function monthlySupportAddon(totalQuantity: number) {
  const supportCents = supportFeeFor(totalQuantity);
  const netSupportCents = supportCents - supportCents * NF_TAX_RATE;
  return { supportCents, netSupportCents };
}

export interface AnnualLicenseCalcRow extends LicenseCalcRowInput {
  /** Meses de contrato desta licença (H). */
  months: number;
}

/** Linha da aba "Anual": custo anualizado → preço anual do cliente → resultado/margem. */
export function computeAnnualLicenseRow(row: AnnualLicenseCalcRow) {
  const unitCostCents = unitCostOf(row); // E
  const iofCents = unitCostCents * IOF_RATE; // F
  const licenseCostCents = row.licenseCostOverrideCents ?? unitCostCents + iofCents; // G · ou ajuste manual
  const totalCostCents = licenseCostCents * row.months * row.quantity; // J
  const cardCostCents = row.quantity * unitCostCents * row.months; // K
  const manualTotal = row.clientTotalOverrideCents != null;
  const unitPriceAnnualCents = row.quantity === 0 ? 0 : row.unitPriceCents * row.months; // M
  const clientAnnualCents = row.clientTotalOverrideCents ?? unitPriceAnnualCents * row.quantity; // N · ou ajuste manual
  const taxCents = clientAnnualCents * NF_TAX_RATE; // O
  const zero = row.quantity === 0 && !manualTotal;
  const netCents = zero ? 0 : clientAnnualCents - taxCents; // P
  const resultCents = zero ? 0 : netCents - totalCostCents; // Q
  const margin = zero || clientAnnualCents === 0 ? null : resultCents / clientAnnualCents; // R
  return {
    unitCostCents,
    iofCents,
    licenseCostCents,
    totalCostCents,
    cardCostCents,
    unitPriceAnnualCents,
    clientAnnualCents,
    taxCents,
    netCents,
    resultCents,
    margin,
  };
}

export type AnnualLicenseCalcResult = ReturnType<typeof computeAnnualLicenseRow>;

/** Linha de totais da aba "Anual" (soma as linhas de licenças). */
export function sumAnnualLicenseRows(rows: ReadonlyArray<AnnualLicenseCalcResult>) {
  const sum = (k: keyof AnnualLicenseCalcResult) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const totalCostCents = sum("totalCostCents");
  const cardCostCents = sum("cardCostCents");
  const clientAnnualCents = sum("clientAnnualCents");
  const netCents = sum("netCents");
  const resultCents = sum("resultCents");
  return {
    totalCostCents,
    cardCostCents,
    clientAnnualCents,
    netCents,
    resultCents,
    margin: clientAnnualCents === 0 ? null : resultCents / clientAnnualCents,
  };
}
