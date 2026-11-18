import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Modelo espelhado na planilha "CLAUDE DATAGROUP 2026".
 * Cada linha da planilha é um CONTRATO; a seção "ATUALIZAÇÃO" vira contratos do tipo "atualizacao".
 *
 * Convenção: todo valor monetário é guardado em CENTAVOS (inteiro).
 * Campos "override" guardam o valor digitado à mão na planilha no lugar da fórmula
 * (ex.: IOF real cobrado). Quando nulos, vale a fórmula — ver src/lib/calc.ts.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const PAYMENT_TYPES = ["mensal", "anual"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SECTORS = ["privado", "governo"] as const;
export type Sector = (typeof SECTORS)[number];

export const CONTRACT_KINDS = ["principal", "atualizacao"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export const BILLING_STATUS = ["ok", "pendente", "valor_errado"] as const;
export type BillingStatus = (typeof BILLING_STATUS)[number];

export const LICENSE_STATUS = ["ok", "pendente"] as const;
export type LicenseStatus = (typeof LICENSE_STATUS)[number];

export const INVOICE_STATUS = ["pendente", "paga"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  lastLoginAt: text("last_login_at"),
});

/** Cliente: colunas B, C, D, AH, AI, AJ. */
export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    name: text("name").notNull(), // B
    sector: text("sector", { enum: SECTORS }).notNull().default("privado"), // C
    document: text("document"), // D — CNPJ
    contactName: text("contact_name"), // AH
    contactEmail: text("contact_email"), // AI
    contactPhone: text("contact_phone"), // AJ
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

/** Contrato = uma linha da planilha. */
export const contracts = sqliteTable(
  "contracts",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CONTRACT_KINDS }).notNull().default("principal"),
    code: text("code"), // A — ID / nº contrato
    description: text("description"), // E — O que foi vendido
    signedAt: text("signed_at"), // F — Data da assinatura (YYYY-MM-DD)
    startAt: text("start_at"), // G — Início da vigência
    endAt: text("end_at"), // H — Fim da vigência
    quantity: integer("quantity"), // I

    paymentType: text("payment_type", { enum: PAYMENT_TYPES }).notNull(), // X — Modalidade

    // Receita
    proposal2027MonthlyCents: integer("proposal_2027_monthly_cents"), // J — Valor Mensal 2027
    licensesMonthlyCents: integer("licenses_monthly_cents"), // K — Valor Mensal
    licensesAnnualOverrideCents: integer("licenses_annual_override_cents"), // L (quando digitado)
    taxOverrideCents: integer("tax_override_cents"), // M (quando digitado)

    // Custo Claude
    claudeMonthlyCents: integer("claude_monthly_cents"), // O — Valor Claude Mensal
    claudeAnnualOverrideCents: integer("claude_annual_override_cents"), // P (quando digitado)
    iofOverrideCents: integer("iof_override_cents"), // Q (quando digitado)
    licenseTotalOverrideCents: integer("license_total_override_cents"), // R (quando digitado)

    // Consultoria (S) = suporte + treinamento para liderança
    supportCents: integer("support_cents").notNull().default(0), // mensal: valor/mês · anual: valor/ano
    trainingCents: integer("training_cents").notNull().default(0), // valor total
    consultingOverrideCents: integer("consulting_override_cents"), // S (quando digitado na Planilha)

    // Status
    action: text("action"), // U — Ação
    billingStatus: text("billing_status", { enum: BILLING_STATUS }).notNull().default("pendente"), // V
    licenseStatus: text("license_status", { enum: LICENSE_STATUS }).notNull().default("pendente"), // W
    owner: text("owner"), // AG — Responsável / observações

    // Financeiro
    paymentMethod: text("payment_method"), // Y — Forma de pagamento
    installments: integer("installments"), // Z — Nº de parcelas
    installmentOverrideCents: integer("installment_override_cents"), // AA (quando digitado)
    receivedCents: integer("received_cents").notNull().default(0), // AB — Valor recebido

    version: integer("version").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [index("contracts_client_idx").on(t.clientId), index("contracts_signed_idx").on(t.signedAt)],
);

export const files = sqliteTable(
  "files",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: text("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["proposta", "invoice"] }).notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("files_client_idx").on(t.clientId)],
);

/** Histórico imutável: cada atualização de contrato guarda um snapshot (JSON) da versão. */
export const contractVersions = sqliteTable(
  "contract_versions",
  {
    id: id(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: text("snapshot", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
    reason: text("reason"),
    fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contract_versions_uq").on(t.contractId, t.version)],
);

/** Invoices da Claude/fornecedor — conferência do custo previsto (coluna R). */
export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: text("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    description: text("description"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: INVOICE_STATUS }).notNull().default("pendente"),
    fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("invoices_client_idx").on(t.clientId)],
);

/** Meta mensal. month = YYYY-MM. */
export const goals = sqliteTable("goals", {
  month: text("month").primaryKey(),
  targetCents: integer("target_cents").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: text("updated_at"),
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type ContractVersion = typeof contractVersions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type StoredFile = typeof files.$inferSelect;
export type Goal = typeof goals.$inferSelect;
