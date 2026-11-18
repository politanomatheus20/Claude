import { z } from "zod";
import { PAYMENT_TYPES, INVOICE_STATUS } from "./db/schema";
import { parseMoneyToCents } from "./format";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Campo de dinheiro vindo do formulário (texto BR) → centavos. */
const money = (label: string, { optional = false } = {}) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) {
        if (optional) return 0;
        ctx.addIssue({ code: "custom", message: `Informe ${label}` });
        return z.NEVER;
      }
      const cents = parseMoneyToCents(v);
      if (cents === null || cents < 0) {
        ctx.addIssue({ code: "custom", message: `${label[0].toUpperCase()}${label.slice(1)} inválido` });
        return z.NEVER;
      }
      return cents;
    });

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

export const proposalSchema = z.object({
  paymentType: z.enum(PAYMENT_TYPES, { message: "Escolha mensal ou anual" }),
  licenses: money("o valor das licenças"),
  support: money("o valor do suporte"),
  hasTraining: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  training: money("o valor do treinamento", { optional: true }),
});

export const clientSchema = proposalSchema.extend({
  name: z.string().trim().min(2, "Informe o nome do cliente"),
  document: optionalText,
  contactName: optionalText,
  contactEmail: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .pipe(z.email("E-mail inválido").nullable()),
  closedAt: isoDate,
  notes: optionalText,
});

export const updateProposalSchema = proposalSchema.extend({
  reason: z.string().trim().min(3, "Descreva o motivo da atualização"),
});

export const invoiceSchema = z.object({
  number: z.string().trim().min(1, "Informe o número da invoice"),
  description: optionalText,
  issueDate: isoDate,
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(isoDate.nullable()),
  amount: money("o valor"),
  status: z.enum(INVOICE_STATUS),
});

export const goalSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido"),
  target: money("o valor da meta"),
});

export type FieldErrors = Record<string, string[] | undefined>;

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Valores enviados, para repreencher o form em caso de erro. */
  values?: Record<string, string>;
}

export function formValues(fd: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
