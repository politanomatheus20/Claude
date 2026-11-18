import "server-only";
import { cache } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { addMonths, format, parse } from "date-fns";
import { requireUser } from "./auth/dal";
import { computeContract, goalMonthOf, goalProgress, sumComputed, type ContractValues } from "./calc";
import { db } from "./db";
import { clients, contractVersions, contracts, files, goals, invoices, users, type Client, type Contract } from "./db/schema";

/**
 * Consultas de leitura. Todas exigem usuário autenticado.
 * Os números vêm SEMPRE de src/lib/calc.ts.
 */

export type ContractRow = Contract & { client: Client; calc: ReturnType<typeof computeContract> };

const withCalc = (c: Contract, client: Client): ContractRow => ({ ...c, client, calc: computeContract(c as ContractValues) });

/** Todos os contratos com o cliente e os cálculos — base da visão "Planilha". */
export async function listContracts() {
  await requireUser();
  const rows = await db
    .select()
    .from(contracts)
    .innerJoin(clients, eq(contracts.clientId, clients.id))
    .orderBy(asc(contracts.kind), asc(contracts.signedAt), asc(contracts.startAt), asc(clients.name));
  return rows.map((r) => withCalc(r.contracts, r.clients)).sort(byKind);
}

/** Contrato principal antes das atualizações (como na planilha). */
const byKind = (a: Contract, b: Contract) => (a.kind === b.kind ? 0 : a.kind === "principal" ? -1 : 1);

export async function getDashboard(month: string) {
  const all = await listContracts();
  const goal = await db.query.goals.findFirst({ where: eq(goals.month, month) });

  const ofMonth = all.filter((c) => goalMonthOf(c) === month);
  const progress = goalProgress(goal?.targetCents ?? 0, ofMonth.map((c) => c.calc.goalContribution));

  const months = Array.from({ length: 6 }, (_, i) => format(addMonths(parse(month, "yyyy-MM", new Date()), i - 5), "yyyy-MM"));
  const goalRows = await db.select().from(goals);
  const goalMap = new Map(goalRows.map((g) => [g.month, g.targetCents]));
  const history = months.map((m) => ({
    month: m,
    achievedCents: all.filter((c) => goalMonthOf(c) === m).reduce((s, c) => s + c.calc.goalContribution, 0),
    targetCents: goalMap.get(m) ?? 0,
  }));

  const expiring = all
    .filter((c) => c.calc.termStatus === "a_vencer" || c.calc.termStatus === "vencido")
    .sort((a, b) => (a.calc.daysToExpire ?? 0) - (b.calc.daysToExpire ?? 0));
  const pending = all.filter((c) => c.billingStatus !== "ok" || c.licenseStatus !== "ok");

  return {
    month,
    goal: goal ?? null,
    progress,
    ofMonth,
    monthTotals: sumComputed(ofMonth.map((c) => c.calc)),
    portfolio: { ...sumComputed(all.map((c) => c.calc)), contracts: all.length },
    history,
    expiring,
    pending,
  };
}

export async function listClients(query?: string) {
  await requireUser();
  const all = await listContracts();
  const q = query?.trim().toLowerCase();
  const byClient = new Map<string, { client: Client; contracts: ContractRow[] }>();
  for (const c of all) {
    const entry = byClient.get(c.clientId) ?? { client: c.client, contracts: [] };
    entry.contracts.push(c);
    byClient.set(c.clientId, entry);
  }
  // clientes sem contrato
  for (const cl of await db.select().from(clients)) {
    if (!byClient.has(cl.id)) byClient.set(cl.id, { client: cl, contracts: [] });
  }
  return [...byClient.values()]
    .filter(({ client }) => !q || client.name.toLowerCase().includes(q) || (client.document ?? "").includes(q))
    .map((e) => {
      const main = e.contracts.find((c) => c.kind === "principal") ?? e.contracts[0];
      return { ...e, main, totals: sumComputed(e.contracts.map((c) => c.calc)) };
    })
    .sort((a, b) => (b.main?.signedAt ?? "").localeCompare(a.main?.signedAt ?? "") || a.client.name.localeCompare(b.client.name));
}

/** Em cache por requisição: a página e o generateMetadata compartilham a mesma leitura. */
export const getClient = cache(async (id: string) => {
  await requireUser();
  const client = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!client) return null;

  const [cts, clientInvoices, clientFiles, people] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.clientId, id)).orderBy(asc(contracts.kind), asc(contracts.startAt)),
    db.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.issueDate)),
    db.select().from(files).where(eq(files.clientId, id)).orderBy(desc(files.createdAt)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);

  const versions = cts.length
    ? await db
        .select()
        .from(contractVersions)
        .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
        .where(eq(contracts.clientId, id))
        .orderBy(desc(contractVersions.createdAt))
    : [];

  const names = new Map(people.map((p) => [p.id, p.name]));
  const fileMap = new Map(clientFiles.map((f) => [f.id, f]));
  const rows = cts.map((c) => withCalc(c, client)).sort(byKind);

  return {
    client,
    contracts: rows,
    totals: sumComputed(rows.map((r) => r.calc)),
    versions: versions.map(({ contract_versions: v, contracts: c }) => ({
      ...v,
      contractLabel: c.kind === "principal" ? (c.code ?? "Contrato") : `Atualização ${c.code ?? ""}`.trim(),
      author: v.createdBy ? (names.get(v.createdBy) ?? "—") : "Importação",
      file: v.fileId ? (fileMap.get(v.fileId) ?? null) : null,
    })),
    invoices: clientInvoices.map((i) => ({ ...i, file: i.fileId ? (fileMap.get(i.fileId) ?? null) : null })),
    invoicesTotal: clientInvoices.reduce((s, i) => s + i.amountCents, 0),
    files: clientFiles,
  };
});

export async function listGoals() {
  await requireUser();
  const [goalRows, all] = await Promise.all([db.select().from(goals).orderBy(desc(goals.month)), listContracts()]);
  return goalRows.map((g) => {
    const achieved = all.filter((c) => goalMonthOf(c) === g.month).reduce((s, c) => s + c.calc.goalContribution, 0);
    return { ...g, progress: goalProgress(g.targetCents, [achieved]) };
  });
}

export async function getFile(id: string) {
  await requireUser();
  return db.query.files.findFirst({ where: eq(files.id, id) });
}
