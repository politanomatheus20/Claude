import { z } from "zod";
import { BILLING_STATUS, INVOICE_STATUS, LICENSE_STATUS, PAYMENT_TYPES, SECTORS } from "./db/schema";
import { parseMoneyToCents } from "./format";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(isoDate.nullable());

/** Dinheiro obrigatório (texto BR → centavos). */
const money = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const cents = v && v.trim() ? parseMoneyToCents(v) : null;
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: v?.trim() ? `${label} inválido` : `Informe ${label.toLowerCase()}` });
        return z.NEVER;
      }
      return cents;
    });

/** Dinheiro opcional: vazio → null (vale a fórmula). */
const moneyOpt = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const cents = parseMoneyToCents(v);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      return cents;
    });

const intOpt = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `${label} inválido` });
        return z.NEVER;
      }
      return n;
    });

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente"),
  sector: z.enum(SECTORS),
  document: optionalText,
  contactName: optionalText,
  contactEmail: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .pipe(z.email("E-mail inválido").nullable()),
  contactPhone: optionalText,
  notes: optionalText,
});

/** Campos de um contrato (uma linha da planilha). */
export const contractSchema = z
  .object({
    code: optionalText, // A
    description: optionalText, // E
    signedAt: optionalDate, // F
    startAt: optionalDate, // G
    endAt: optionalDate, // H
    quantity: intOpt("Quantidade"), // I
    paymentType: z.enum(PAYMENT_TYPES, { message: "Escolha mensal ou anual" }), // X
    proposal2027Monthly: moneyOpt("Valor mensal 2027"), // J
    licensesMonthly: moneyOpt("Valor mensal"), // K
    licensesAnnual: moneyOpt("Valor anual"), // L
    taxOverride: moneyOpt("Imposto NF"), // M
    claudeMonthly: moneyOpt("Valor Claude mensal"), // O
    claudeAnnual: moneyOpt("Valor licença anual"), // P
    iofOverride: moneyOpt("IOF"), // Q
    licenseTotalOverride: moneyOpt("Total licença"), // R
    support: moneyOpt("Suporte"),
    hasTraining: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    training: moneyOpt("Treinamento"),
    action: optionalText, // U
    billingStatus: z.enum(BILLING_STATUS), // V
    licenseStatus: z.enum(LICENSE_STATUS), // W
    owner: optionalText, // AG
    paymentMethod: optionalText, // Y
    installments: intOpt("Nº de parcelas"), // Z
    installmentOverride: moneyOpt("Valor por parcela"), // AA
    received: moneyOpt("Valor recebido"), // AB
  })
  .superRefine((d, ctx) => {
    if (d.licensesMonthly === null && d.licensesAnnual === null) {
      ctx.addIssue({ code: "custom", path: ["licensesMonthly"], message: "Informe o valor mensal ou o anual" });
    }
    if (d.startAt && d.endAt && d.endAt < d.startAt) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "Fim antes do início" });
    }
    if (d.installments === 0) {
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Mínimo 1 parcela" });
    }
  })
  .transform((d) => {
    // K digitado e L vazio → L = K × 12 (fórmula). L digitado → vira override.
    const licensesAnnualOverrideCents =
      d.licensesAnnual !== null && !(d.licensesMonthly !== null && d.licensesAnnual === d.licensesMonthly * 12)
        ? d.licensesAnnual
        : null;
    const claudeAnnualOverrideCents =
      d.claudeAnnual !== null && !(d.claudeMonthly !== null && d.claudeAnnual === d.claudeMonthly * 12) ? d.claudeAnnual : null;
    return {
      code: d.code,
      description: d.description,
      signedAt: d.signedAt,
      startAt: d.startAt,
      endAt: d.endAt,
      quantity: d.quantity,
      paymentType: d.paymentType,
      proposal2027MonthlyCents: d.proposal2027Monthly,
      licensesMonthlyCents: d.licensesMonthly,
      licensesAnnualOverrideCents,
      taxOverrideCents: d.taxOverride,
      claudeMonthlyCents: d.claudeMonthly,
      claudeAnnualOverrideCents,
      iofOverrideCents: d.iofOverride,
      licenseTotalOverrideCents: d.licenseTotalOverride,
      supportCents: d.support ?? 0,
      trainingCents: d.hasTraining ? (d.training ?? 0) : 0,
      action: d.action,
      billingStatus: d.billingStatus,
      licenseStatus: d.licenseStatus,
      owner: d.owner,
      paymentMethod: d.paymentMethod,
      installments: d.installments,
      installmentOverrideCents: d.installmentOverride,
      receivedCents: d.received ?? 0,
    };
  });

export type ContractInput = z.output<typeof contractSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Descreva o motivo da atualização"),
});

export const invoiceSchema = z.object({
  number: z.string().trim().min(1, "Informe o número da invoice"),
  description: optionalText,
  issueDate: isoDate,
  dueDate: optionalDate,
  amount: money("O valor"),
  status: z.enum(INVOICE_STATUS),
  contractId: optionalText,
});

export const goalSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
  target: money("O valor da meta"),
});

export type FieldErrors = Record<string, string[] | undefined>;

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
}

export function formValues(fd: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Junta erros de vários safeParse. */
export function mergeErrors(...results: { success: boolean; error?: z.ZodError }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const r of results) {
    if (r.success || !r.error) continue;
    for (const issue of r.error.issues) {
      const key = String(issue.path[0] ?? "_");
      out[key] = [...(out[key] ?? []), issue.message];
    }
  }
  return out;
}
