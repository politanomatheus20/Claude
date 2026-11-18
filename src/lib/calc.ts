/**
 * Regras de negócio — fonte única de verdade para todos os cálculos.
 *
 * Funções puras, sem I/O, todas em CENTAVOS (inteiros). Qualquer tela,
 * relatório ou action deve usar estas funções; nunca recalcule em outro lugar.
 *
 * Convenção dos valores da proposta:
 * - Pagamento MENSAL: licenças e suporte são valores MENSAIS.
 * - Pagamento ANUAL: licenças e suporte são o valor ANUAL (parcela única).
 * - Treinamento de liderança: valor total, pago uma única vez.
 */

import type { PaymentType } from "./db/schema";

export interface ProposalValues {
  paymentType: PaymentType;
  licensesCents: number;
  supportCents: number;
  trainingCents: number;
}

const MONTHS_IN_YEAR = 12;

/** Divisão por 12 com arredondamento para o centavo mais próximo. */
const perMonth = (cents: number) => Math.round(cents / MONTHS_IN_YEAR);

/**
 * Suporte mensal.
 * - Mensal: o próprio valor.
 * - Anual: valor ÷ 12.
 */
export function monthlySupport(p: ProposalValues): number {
  return p.paymentType === "anual" ? perMonth(p.supportCents) : p.supportCents;
}

/** Treinamento de liderança diluído no mês: valor ÷ 12. */
export function monthlyTraining(p: ProposalValues): number {
  return perMonth(p.trainingCents);
}

/**
 * Quanto o cliente soma na META mensal.
 * Considera APENAS suporte (+ treinamento de liderança ÷ 12). Licenças não entram.
 */
export function goalContribution(p: ProposalValues): number {
  return monthlySupport(p) + monthlyTraining(p);
}

/**
 * Receita total do contrato no período de 12 meses.
 * - Mensal: (licenças + suporte) × 12 + treinamento.
 * - Anual: licenças + suporte + treinamento.
 */
export function contractRevenue(p: ProposalValues): number {
  const recurring = p.licensesCents + p.supportCents;
  const yearly = p.paymentType === "mensal" ? recurring * MONTHS_IN_YEAR : recurring;
  return yearly + p.trainingCents;
}

/** Custo = soma das invoices do cliente. */
export function totalCost(invoices: ReadonlyArray<{ amountCents: number }>): number {
  return invoices.reduce((sum, i) => sum + i.amountCents, 0);
}

export interface ClientResult {
  revenueCents: number;
  costCents: number;
  resultCents: number;
  /** Margem em fração (0.25 = 25%). null quando não há receita. */
  margin: number | null;
}

/** Resultado = receita do contrato − custo. */
export function clientResult(p: ProposalValues, invoices: ReadonlyArray<{ amountCents: number }>): ClientResult {
  const revenueCents = contractRevenue(p);
  const costCents = totalCost(invoices);
  const resultCents = revenueCents - costCents;
  return {
    revenueCents,
    costCents,
    resultCents,
    margin: revenueCents > 0 ? resultCents / revenueCents : null,
  };
}

export interface GoalProgress {
  targetCents: number;
  achievedCents: number;
  /** Quanto falta para a meta (nunca negativo). */
  remainingCents: number;
  /** Quanto falta para a metade da meta (nunca negativo). */
  remainingToHalfCents: number;
  /** Fração atingida, limitada a 1 para a barra. */
  ratio: number;
  /** Fração real (pode passar de 1 quando a meta é superada). */
  rawRatio: number;
  exceededCents: number;
  reached: boolean;
  halfReached: boolean;
}

export function goalProgress(targetCents: number, contributions: ReadonlyArray<number>): GoalProgress {
  const achievedCents = contributions.reduce((s, c) => s + c, 0);
  const half = Math.ceil(targetCents / 2);
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

/** "2026-11-05" → "2026-11" */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);
