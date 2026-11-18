/**
 * Edição célula a célula da visão Planilha.
 *
 * Módulo PURO, usado no navegador (recalculo instantâneo) e no servidor (gravação),
 * para que os dois apliquem exatamente a mesma regra.
 */
import { annualSupport } from "./calc";
import {
  BILLING_STATUS,
  LICENSE_STATUS,
  PAYMENT_TYPES,
  SECTORS,
  type Client,
  type Contract,
} from "./db/schema";
import { parseMoneyToCents } from "./format";

type Kind = "text" | "int" | "money" | "date" | "enum" | "email";

interface FieldSpec {
  col: string;
  label: string;
  target: "contract" | "client";
  kind: Kind;
  required?: boolean;
  options?: readonly string[];
  /** Vazio vira 0 (em vez de null). */
  zeroIfEmpty?: boolean;
  /** Coluna com fórmula: vazio = volta para a fórmula. */
  formula?: string;
}

export const SHEET_FIELDS = {
  code: { col: "A", label: "ID / nº contrato", target: "contract", kind: "text" },
  name: { col: "B", label: "Nome do cliente", target: "client", kind: "text", required: true },
  sector: { col: "C", label: "Setor", target: "client", kind: "enum", options: SECTORS },
  document: { col: "D", label: "CNPJ", target: "client", kind: "text" },
  description: { col: "E", label: "O que foi vendido", target: "contract", kind: "text" },
  signedAt: { col: "F", label: "Data da assinatura", target: "contract", kind: "date" },
  startAt: { col: "G", label: "Início da vigência", target: "contract", kind: "date" },
  endAt: { col: "H", label: "Fim da vigência", target: "contract", kind: "date" },
  quantity: { col: "I", label: "Quantidade", target: "contract", kind: "int" },
  proposal2027MonthlyCents: { col: "J", label: "Valor mensal 2027", target: "contract", kind: "money" },
  licensesMonthlyCents: { col: "K", label: "Valor mensal", target: "contract", kind: "money", formula: "L ÷ 12" },
  licensesAnnualOverrideCents: { col: "L", label: "Valor anual", target: "contract", kind: "money", formula: "K × 12" },
  taxOverrideCents: { col: "M", label: "Imposto NF", target: "contract", kind: "money", formula: "L × 12%" },
  claudeMonthlyCents: { col: "O", label: "Valor Claude mensal", target: "contract", kind: "money" },
  claudeAnnualOverrideCents: { col: "P", label: "Valor licença anual", target: "contract", kind: "money", formula: "O × 12" },
  iofOverrideCents: { col: "Q", label: "IOF", target: "contract", kind: "money", formula: "P × 3,5%" },
  licenseTotalOverrideCents: { col: "R", label: "Total licença", target: "contract", kind: "money", formula: "P + Q" },
  consulting: { col: "S", label: "Consultoria", target: "contract", kind: "money", zeroIfEmpty: true },
  action: { col: "U", label: "Ação", target: "contract", kind: "text" },
  billingStatus: { col: "V", label: "Faturamento", target: "contract", kind: "enum", options: BILLING_STATUS },
  licenseStatus: { col: "W", label: "Licenças", target: "contract", kind: "enum", options: LICENSE_STATUS },
  paymentType: { col: "X", label: "Modalidade", target: "contract", kind: "enum", options: PAYMENT_TYPES },
  paymentMethod: { col: "Y", label: "Forma de pagamento", target: "contract", kind: "text" },
  installments: { col: "Z", label: "Nº de parcelas", target: "contract", kind: "int", formula: "12 (mensal) ou 1 (anual)" },
  installmentOverrideCents: { col: "AA", label: "Valor por parcela", target: "contract", kind: "money", formula: "L ÷ Z" },
  receivedCents: { col: "AB", label: "Valor recebido", target: "contract", kind: "money", zeroIfEmpty: true },
  owner: { col: "AG", label: "Responsável / observações", target: "contract", kind: "text" },
  contactName: { col: "AH", label: "Nome do contato", target: "client", kind: "text" },
  contactEmail: { col: "AI", label: "E-mail do contato", target: "client", kind: "email" },
  contactPhone: { col: "AJ", label: "Telefone do contato", target: "client", kind: "text" },
} as const satisfies Record<string, FieldSpec>;

export type SheetField = keyof typeof SHEET_FIELDS;
export type SheetValue = string | number | null;

export const isSheetField = (f: string): f is SheetField => f in SHEET_FIELDS;

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/** Texto digitado na célula → valor tipado. */
export function parseSheetValue(field: SheetField, raw: string): Result<SheetValue> {
  const spec: FieldSpec = SHEET_FIELDS[field];
  const s = raw.trim();
  if (!s) {
    if (spec.required) return { ok: false, message: `${spec.label} é obrigatório.` };
    if (spec.kind === "enum") return { ok: false, message: `Escolha um valor para ${spec.label}.` };
    return { ok: true, value: spec.zeroIfEmpty ? 0 : null };
  }
  switch (spec.kind) {
    case "text":
      return { ok: true, value: s };
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { ok: true, value: s } : { ok: false, message: "E-mail inválido." };
    case "int": {
      const n = Number(s);
      return Number.isInteger(n) && n >= 0 ? { ok: true, value: n } : { ok: false, message: `${spec.label}: use um número inteiro.` };
    }
    case "money": {
      const c = parseMoneyToCents(s);
      return c !== null && c >= 0 ? { ok: true, value: c } : { ok: false, message: `${spec.label}: valor inválido.` };
    }
    case "date": {
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return { ok: true, value: s };
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return { ok: true, value: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` };
      return { ok: false, message: `${spec.label}: use dd/mm/aaaa.` };
    }
    case "enum":
      return spec.options?.includes(s) ? { ok: true, value: s } : { ok: false, message: `${spec.label}: valor inválido.` };
  }
}

export interface SheetPatch {
  contract: Partial<Contract>;
  client: Partial<Client>;
}

/**
 * Aplica a edição respeitando as regras da planilha:
 * - L/P iguais à fórmula (K×12 / O×12) voltam a ser fórmula (sem ajuste manual);
 * - S (consultoria) é convertido em suporte, mantendo o treinamento;
 * - trocar a modalidade (X) preserva a consultoria anual (S).
 */
export function applySheetEdit(contract: Contract, field: SheetField, value: SheetValue): Result<SheetPatch> {
  const spec = SHEET_FIELDS[field];
  if (spec.target === "client") return { ok: true, value: { contract: {}, client: { [field]: value } as Partial<Client> } };

  const patch: Partial<Contract> = {};
  switch (field) {
    case "licensesAnnualOverrideCents": {
      const k = contract.licensesMonthlyCents;
      patch.licensesAnnualOverrideCents = value !== null && k !== null && value === k * 12 ? null : (value as number | null);
      break;
    }
    case "claudeAnnualOverrideCents": {
      const o = contract.claudeMonthlyCents;
      patch.claudeAnnualOverrideCents = value !== null && o !== null && value === o * 12 ? null : (value as number | null);
      break;
    }
    case "consulting": {
      const yearly = (value as number) - contract.trainingCents;
      if (yearly < 0) return { ok: false, message: "Consultoria menor que o treinamento já lançado." };
      patch.supportCents = contract.paymentType === "anual" ? yearly : Math.round(yearly / 12);
      break;
    }
    case "paymentType": {
      const yearly = annualSupport(contract);
      patch.paymentType = value as Contract["paymentType"];
      patch.supportCents = value === "anual" ? yearly : Math.round(yearly / 12);
      break;
    }
    default:
      (patch as Record<string, unknown>)[field] = value;
  }
  return { ok: true, value: { contract: patch, client: {} } };
}
