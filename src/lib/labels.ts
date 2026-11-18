import type { FinancialStatus, TermStatus } from "./calc";
import type { BillingStatus, LicenseStatus, Sector } from "./db/schema";

type Tone = "neutral" | "teal" | "blue" | "warn" | "danger";

export const billingLabel: Record<BillingStatus, { label: string; tone: Tone }> = {
  ok: { label: "OK", tone: "teal" },
  pendente: { label: "Pendente", tone: "warn" },
  valor_errado: { label: "Valor errado", tone: "danger" },
};

export const licenseLabel: Record<LicenseStatus, { label: string; tone: Tone }> = {
  ok: { label: "OK", tone: "teal" },
  pendente: { label: "Pendente", tone: "warn" },
};

export const termLabel: Record<TermStatus, { label: string; tone: Tone }> = {
  ativo: { label: "Ativo", tone: "teal" },
  a_vencer: { label: "A vencer", tone: "warn" },
  vencido: { label: "Vencido", tone: "danger" },
  sem_data: { label: "Sem data", tone: "neutral" },
};

export const financialLabel: Record<FinancialStatus, { label: string; tone: Tone }> = {
  a_receber: { label: "A receber", tone: "warn" },
  recebido: { label: "Recebido", tone: "teal" },
};

export const sectorLabel: Record<Sector, string> = { privado: "Privado", governo: "Governo" };

export const PRODUCT_SUGGESTIONS = [
  "Licenças Claude Team Standard",
  "Licenças Claude Team Premium",
  "Licenças Claude Team Standard/Premium",
];

export const ACTION_SUGGESTIONS = [
  "OK - ENVIADO PROPOSTA 2027",
  "OK - ANUAL",
  "OK - GOVERNO",
  "OK - PAGARAM ANUAL - NOS MENSAL",
  "OK - PAGAM MENSAL - NOS ANUAL",
  "OK - TREINAMENTO",
];

export const PAYMENT_METHOD_SUGGESTIONS = ["Boleto", "PIX", "Transferência", "Cartão de crédito"];
