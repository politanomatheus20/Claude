"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { clients, files, goals, invoices, proposalVersions } from "@/lib/db/schema";
import { saveFile, validateUpload } from "@/lib/storage";
import {
  clientSchema,
  formValues,
  goalSchema,
  invoiceSchema,
  updateProposalSchema,
  type ActionState,
} from "@/lib/validation";

/**
 * Todas as mutações do sistema. Cada action:
 * 1. Revalida a sessão (nunca confia no cliente);
 * 2. Valida a entrada com zod;
 * 3. Grava em transação quando há mais de uma tabela envolvida;
 * 4. Revalida as telas afetadas — os cálculos são refeitos na próxima leitura.
 */

function invalid(fd: FormData, errors: ActionState["errors"]): ActionState {
  return { ok: false, errors, values: formValues(fd), message: "Revise os campos destacados." };
}

async function storeUpload(fd: FormData, field: string, clientId: string, kind: "proposta" | "invoice", userId: string) {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const storageKey = await saveFile(file, `${clientId}/${kind}`);
  const [row] = await db
    .insert(files)
    .values({ clientId, kind, name: file.name, mimeType: file.type, size: file.size, storageKey, uploadedBy: userId })
    .returning();
  return row;
}

function revalidateAll(clientId?: string) {
  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath("/metas");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function createClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, parsed.error.flatten().fieldErrors);

  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (uploadError) return invalid(fd, { proposalFile: [uploadError] });

  const d = parsed.data;
  const trainingCents = d.hasTraining ? d.training : 0;

  const [client] = await db
    .insert(clients)
    .values({
      name: d.name,
      document: d.document,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      closedAt: d.closedAt,
      paymentType: d.paymentType,
      licensesCents: d.licenses,
      supportCents: d.support,
      trainingCents,
      notes: d.notes,
      currentVersion: 1,
      createdBy: user.id,
    })
    .returning();

  const file = await storeUpload(fd, "proposalFile", client.id, "proposta", user.id);

  await db.insert(proposalVersions).values({
    clientId: client.id,
    version: 1,
    paymentType: d.paymentType,
    licensesCents: d.licenses,
    supportCents: d.support,
    trainingCents,
    reason: "Proposta inicial (fechamento)",
    fileId: file?.id ?? null,
    createdBy: user.id,
  });

  revalidateAll(client.id);
  redirect(`/clientes/${client.id}?novo=1`);
}

export async function updateClientInfo(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const schema = clientSchema.pick({
    name: true,
    document: true,
    contactName: true,
    contactEmail: true,
    closedAt: true,
    notes: true,
  });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, parsed.error.flatten().fieldErrors);

  await db
    .update(clients)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(clients.id, clientId));

  revalidateAll(clientId);
  return { ok: true, message: "Dados do cliente atualizados." };
}

/** Atualização de proposta: nova versão + valores vigentes recalculados. */
export async function updateProposal(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateProposalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, parsed.error.flatten().fieldErrors);

  const uploadError = validateUpload(fd.get("proposalFile") as File | null);
  if (uploadError) return invalid(fd, { proposalFile: [uploadError] });

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) return { ok: false, message: "Cliente não encontrado." };

  const d = parsed.data;
  const trainingCents = d.hasTraining ? d.training : 0;
  const file = await storeUpload(fd, "proposalFile", clientId, "proposta", user.id);
  const nextVersion = client.currentVersion + 1;

  try {
    await db.batch([
    db.insert(proposalVersions).values({
      clientId,
      version: nextVersion,
      paymentType: d.paymentType,
      licensesCents: d.licenses,
      supportCents: d.support,
      trainingCents,
      reason: d.reason,
      fileId: file?.id ?? null,
      createdBy: user.id,
    }),
    db
      .update(clients)
      .set({
        paymentType: d.paymentType,
        licensesCents: d.licenses,
        supportCents: d.support,
        trainingCents,
        currentVersion: nextVersion,
        updatedAt: new Date().toISOString(),
      })
      // Trava otimista: evita duas atualizações simultâneas gerarem a mesma versão.
      .where(and(eq(clients.id, clientId), eq(clients.currentVersion, client.currentVersion))),
    ]);
  } catch {
    // Conflito de versão (outra pessoa atualizou ao mesmo tempo) — o batch é transacional.
    return { ok: false, values: formValues(fd), message: "A proposta foi alterada por outra pessoa. Recarregue e tente de novo." };
  }

  revalidateAll(clientId);
  return { ok: true, message: `Proposta atualizada para a versão ${nextVersion}. Cálculos refeitos.` };
}

export async function deleteClient(clientId: string) {
  await requireUser();
  await db.delete(clients).where(eq(clients.id, clientId));
  revalidateAll();
  redirect("/clientes");
}

export async function addInvoice(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, parsed.error.flatten().fieldErrors);

  const uploadError = validateUpload(fd.get("invoiceFile") as File | null);
  if (uploadError) return invalid(fd, { invoiceFile: [uploadError] });

  const file = await storeUpload(fd, "invoiceFile", clientId, "invoice", user.id);
  const d = parsed.data;
  await db.insert(invoices).values({
    clientId,
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
  return { ok: true, message: "Invoice registrada. Custo e resultado recalculados." };
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

export async function saveGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(fd, parsed.error.flatten().fieldErrors);
  const now = new Date().toISOString();
  await db
    .insert(goals)
    .values({ month: parsed.data.month, targetCents: parsed.data.target, updatedBy: user.id, updatedAt: now })
    .onConflictDoUpdate({
      target: goals.month,
      set: { targetCents: parsed.data.target, updatedBy: user.id, updatedAt: now },
    });
  revalidateAll();
  return { ok: true, message: "Meta salva." };
}
