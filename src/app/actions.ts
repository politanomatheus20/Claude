"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { clients, contractVersions, contracts, files, goals, invoices, type Client, type Contract, type ContractKind } from "@/lib/db/schema";
import { applySheetEdit, isSheetField, parseSheetValue, SHEET_FIELDS } from "@/lib/sheet-edit";
import { money } from "@/lib/format";
import { deleteStoredFile, saveFile, validateUpload } from "@/lib/storage";
import {
  clientSchema,
  contractSchema,
  formValues,
  goalSchema,
  invoiceSchema,
  mergeErrors,
  reasonSchema,
  type ActionState,
} from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/format";

/**
 * Todas as mutações. Cada action revalida a sessão, valida com zod,
 * grava e revalida as telas. Os cálculos são refeitos na leitura (src/lib/calc.ts).
 */

function invalid(fd: FormData, errors: ActionState["errors"], message = "Revise os campos destacados."): ActionState {
  return { ok: false, errors, values: formValues(fd), message };
}

async function storeUpload(
  fd: FormData,
  field: string,
  clientId: string,
  kind: "proposta" | "invoice",
  userId: string,
  contractId?: string | null,
) {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const storageKey = await saveFile(file, `${clientId}/${kind}`);
  const [row] = await db
    .insert(files)
    .values({ clientId, contractId: contractId ?? null, kind, name: file.name, mimeType: file.type, size: file.size, storageKey, uploadedBy: userId })
    .returning();
  return row;
}

/**
 * Aplica uma alteração campo a campo num contrato, gravando a versão no histórico.
 * Se outra gravação acontecer ao mesmo tempo (inclusive edições rápidas do próprio
 * usuário), relê o contrato e reaplica — cada alteração mexe só nos seus campos.
 */
async function patchContract(
  contractId: string,
  userId: string,
  build: (current: Contract) => { patch: Partial<Contract>; reason: string } | { error: string },
): Promise<{ ok: true; contract: Contract } | { ok: false; message: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
    if (!current) return { ok: false, message: "Contrato não encontrado." };
    const b = build(current);
    if ("error" in b) return { ok: false, message: b.error };
    const next = current.version + 1;
    try {
      await db.batch([
        db.insert(contractVersions).values({ contractId, version: next, snapshot: b.patch, reason: b.reason, createdBy: userId }),
        db
          .update(contracts)
          .set({ ...b.patch, version: next, updatedAt: new Date().toISOString() })
          .where(and(eq(contracts.id, contractId), eq(contracts.version, current.version))),
      ]);
      return { ok: true, contract: { ...current, ...b.patch, version: next } };
    } catch {
      // versão disputada: tenta de novo sobre o estado mais recente
    }
  }
  return { ok: false, message: "Muitas alterações ao mesmo tempo neste contrato. Tente de novo." };
}

function revalidateAll(clientId?: string) {
  for (const p of ["/", "/clientes", "/planilha", "/metas"]) revalidatePath(p);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function createClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(fd);
  const c = clientSchema.safeParse(raw);
  const k = contractSchema.safeParse(raw);
  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (!c.success || !k.success || uploadError) {
    const errors = mergeErrors(c, k);
    if (uploadError) errors.proposalFile = [uploadError];
    return invalid(fd, errors);
  }

  const [client] = await db.insert(clients).values({ ...c.data, createdBy: user.id }).returning();
  const [contract] = await db
    .insert(contracts)
    .values({ ...k.data, kind: "principal", clientId: client.id, createdBy: user.id })
    .returning();
  const file = await storeUpload(fd, "proposalFile", client.id, "proposta", user.id, contract.id);
  await db.insert(contractVersions).values({
    contractId: contract.id,
    version: 1,
    snapshot: k.data,
    reason: "Proposta inicial (fechamento)",
    fileId: file?.id ?? null,
    createdBy: user.id,
  });

  revalidateAll(client.id);
  redirect(`/clientes/${client.id}?novo=1`);
}

export async function updateClientInfo(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, mergeErrors(parsed));
  await db.update(clients).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(clients.id, clientId));
  revalidateAll(clientId);
  return { ok: true, message: "Dados do cliente atualizados." };
}

/** Adiciona um contrato ao cliente: "atualizacao" (aditivo, como na seção ATUALIZAÇÃO) ou outro "principal". */
export async function addContract(clientId: string, kind: ContractKind, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const k = contractSchema.safeParse(Object.fromEntries(fd));
  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (!k.success || uploadError) {
    const errors = mergeErrors(k);
    if (uploadError) errors.proposalFile = [uploadError];
    return invalid(fd, errors);
  }
  const [contract] = await db.insert(contracts).values({ ...k.data, kind, clientId, createdBy: user.id }).returning();
  const file = await storeUpload(fd, "proposalFile", clientId, "proposta", user.id, contract.id);
  await db.insert(contractVersions).values({
    contractId: contract.id,
    version: 1,
    snapshot: k.data,
    reason: kind === "atualizacao" ? "Atualização registrada" : "Novo contrato",
    fileId: file?.id ?? null,
    createdBy: user.id,
  });
  revalidateAll(clientId);
  return { ok: true, message: kind === "atualizacao" ? "Atualização registrada. Cálculos refeitos." : "Contrato registrado." };
}

/** Atualiza um contrato: nova versão no histórico + recálculo de tudo. */
export async function updateContract(contractId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = Object.fromEntries(fd);
  const k = contractSchema.safeParse(raw);
  const r = reasonSchema.safeParse(raw);
  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (!k.success || !r.success || uploadError) {
    const errors = mergeErrors(k, r);
    if (uploadError) errors.proposalFile = [uploadError];
    return invalid(fd, errors);
  }

  const current = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
  if (!current) return { ok: false, message: "Contrato não encontrado." };

  const file = await storeUpload(fd, "proposalFile", current.clientId, "proposta", user.id, contractId);
  const next = current.version + 1;
  try {
    await db.batch([
      db.insert(contractVersions).values({
        contractId,
        version: next,
        snapshot: k.data,
        reason: r.data.reason,
        fileId: file?.id ?? null,
        createdBy: user.id,
      }),
      db
        .update(contracts)
        .set({ ...k.data, version: next, updatedAt: new Date().toISOString() })
        .where(and(eq(contracts.id, contractId), eq(contracts.version, current.version))),
    ]);
  } catch {
    return invalid(fd, {}, "O contrato foi alterado por outra pessoa. Recarregue e tente de novo.");
  }

  revalidateAll(current.clientId);
  return { ok: true, message: `Contrato atualizado (versão ${next}). Cálculos refeitos.` };
}

/** Registra um recebimento: soma no "Valor recebido" (AB) e recalcula o saldo (AC). */
export async function addReceipt(contractId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const amount = parseMoneyToCents(String(fd.get("amount") ?? ""));
  if (!amount || amount <= 0) return invalid(fd, { amount: ["Informe o valor recebido"] });
  const res = await patchContract(contractId, user.id, (current) => ({
    patch: { receivedCents: current.receivedCents + amount },
    reason: `Recebimento de ${money(amount)}`,
  }));
  if (!res.ok) return { ok: false, message: res.message };
  revalidateAll(res.contract.clientId);
  return { ok: true, message: "Recebimento registrado. Saldo recalculado." };
}

export async function deleteContract(contractId: string) {
  await requireUser();
  const current = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
  if (!current) return;
  await db.delete(contracts).where(eq(contracts.id, contractId));
  revalidateAll(current.clientId);
}

export async function deleteClient(clientId: string) {
  await requireUser();
  const stored = await db.select({ key: files.storageKey }).from(files).where(eq(files.clientId, clientId));
  await db.delete(clients).where(eq(clients.id, clientId));
  await Promise.allSettled(stored.map((f) => deleteStoredFile(f.key)));
  revalidateAll();
  redirect("/clientes");
}

export async function addInvoice(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(fd));
  const uploadError = validateUpload(fd.get("invoiceFile") as File | null);
  if (!parsed.success || uploadError) {
    const errors = mergeErrors(parsed);
    if (uploadError) errors.invoiceFile = [uploadError];
    return invalid(fd, errors);
  }
  const d = parsed.data;
  const file = await storeUpload(fd, "invoiceFile", clientId, "invoice", user.id, d.contractId);
  await db.insert(invoices).values({
    clientId,
    contractId: d.contractId,
    number: d.number,
    description: d.description,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    amountCents: d.amount,
    status: d.status,
    fileId: file?.id ?? null,
    createdBy: user.id,
  });
  revalidateAll(clientId);
  return { ok: true, message: "Invoice registrada." };
}

export async function setInvoiceStatus(invoiceId: string, clientId: string, status: "pendente" | "paga") {
  await requireUser();
  await db.update(invoices).set({ status }).where(and(eq(invoices.id, invoiceId), eq(invoices.clientId, clientId)));
  revalidateAll(clientId);
}

export async function deleteInvoice(invoiceId: string, clientId: string) {
  await requireUser();
  await db.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.clientId, clientId)));
  revalidateAll(clientId);
}

export async function attachProposalFile(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (uploadError) return invalid(fd, { proposalFile: [uploadError] });
  const file = await storeUpload(fd, "proposalFile", clientId, "proposta", user.id);
  if (!file) return invalid(fd, { proposalFile: ["Selecione um arquivo."] });
  revalidateAll(clientId);
  return { ok: true, message: "Anexo adicionado." };
}

export type SheetCellResult = { ok: true; contract: Contract; client: Client } | { ok: false; message: string };

/** Edição de uma célula da visão Planilha. Mesma regra do navegador (src/lib/sheet-edit.ts). */
export async function updateSheetCell(contractId: string, field: string, raw: string): Promise<SheetCellResult> {
  const user = await requireUser();
  if (!isSheetField(field)) return { ok: false, message: "Coluna não editável." };

  const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
  if (!contract) return { ok: false, message: "Contrato não encontrado." };

  const parsed = parseSheetValue(field, raw);
  if (!parsed.ok) return parsed;
  const spec = SHEET_FIELDS[field];
  const now = new Date().toISOString();

  if (spec.target === "client") {
    await db.update(clients).set({ [field]: parsed.value, updatedAt: now }).where(eq(clients.id, contract.clientId));
  } else {
    const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "fórmula/vazio" : spec.kind === "money" ? money(Number(v)) : String(v));
    const res = await patchContract(contractId, user.id, (current) => {
      const applied = applySheetEdit(current, field, parsed.value);
      if (!applied.ok) return { error: applied.message };
      const before = field === "consulting" ? null : (current as Record<string, unknown>)[field];
      return {
        patch: applied.value.contract,
        reason: `Planilha · ${spec.col} ${spec.label}: ${field === "consulting" ? "" : `${fmt(before)} → `}${fmt(parsed.value)}`,
      };
    });
    if (!res.ok) return res;
  }

  const [fresh, freshClient] = await Promise.all([
    db.query.contracts.findFirst({ where: eq(contracts.id, contractId) }),
    db.query.clients.findFirst({ where: eq(clients.id, contract.clientId) }),
  ]);
  // Sem revalidatePath: todas as telas são dinâmicas (leem a sessão) e buscam dados novos
  // ao navegar; revalidar aqui faria o servidor renderizar a Planilha inteira a cada célula.
  return { ok: true, contract: fresh!, client: freshClient! };
}

export async function saveGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, mergeErrors(parsed));
  const now = new Date().toISOString();
  await db
    .insert(goals)
    .values({ month: parsed.data.month, targetCents: parsed.data.target, updatedBy: user.id, updatedAt: now })
    .onConflictDoUpdate({ target: goals.month, set: { targetCents: parsed.data.target, updatedBy: user.id, updatedAt: now } });
  revalidateAll();
  return { ok: true, message: "Meta salva." };
}
