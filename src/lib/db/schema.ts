import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Convenção: todo valor monetário é guardado em CENTAVOS (inteiro).
 * Nunca use float para dinheiro.
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

export const INVOICE_STATUS = ["pendente", "paga"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  lastLoginAt: text("last_login_at"),
});

export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    name: text("name").notNull(),
    document: text("document"), // CNPJ (opcional)
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    /** Data em que o cliente fechou (YYYY-MM-DD). Define o mês da meta. */
    closedAt: text("closed_at").notNull(),
    // Valores vigentes = última versão da proposta (desnormalizado para consultas rápidas).
    paymentType: text("payment_type", { enum: PAYMENT_TYPES }).notNull(),
    licensesCents: integer("licenses_cents").notNull().default(0),
    supportCents: integer("support_cents").notNull().default(0),
    trainingCents: integer("training_cents").notNull().default(0),
    currentVersion: integer("current_version").notNull().default(1),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [index("clients_closed_at_idx").on(t.closedAt)],
);

export const files = sqliteTable(
  "files",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["proposta", "invoice"] }).notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    /** Chave no storage local ou URL do Vercel Blob. */
    storageKey: text("storage_key").notNull(),
    uploadedBy: text("uploaded_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("files_client_idx").on(t.clientId)],
);

/** Histórico imutável: cada atualização da proposta gera uma nova versão. */
export const proposalVersions = sqliteTable(
  "proposal_versions",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    paymentType: text("payment_type", { enum: PAYMENT_TYPES }).notNull(),
    licensesCents: integer("licenses_cents").notNull(),
    supportCents: integer("support_cents").notNull(),
    trainingCents: integer("training_cents").notNull(),
    reason: text("reason"),
    fileId: text("file_id").references(() => files.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("proposal_versions_client_version_uq").on(t.clientId, t.version)],
);

/** Invoices de custo vinculadas ao cliente (base do custo e do resultado). */
export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
export type ProposalVersion = typeof proposalVersions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type StoredFile = typeof files.$inferSelect;
export type Goal = typeof goals.$inferSelect;
