import "server-only";
import { and, asc, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import { addMonths, format, parse } from "date-fns";
import { requireUser } from "./auth/dal";
import { clientResult, goalContribution, goalProgress, monthOf } from "./calc";
import { db } from "./db";
import { clients, files, goals, invoices, proposalVersions, users } from "./db/schema";

/**
 * Consultas de leitura. Todas exigem usuário autenticado (requireUser).
 * Os cálculos vêm sempre de src/lib/calc.ts.
 */

function monthRange(month: string) {
  const start = parse(month, "yyyy-MM", new Date());
  return { from: format(start, "yyyy-MM-dd"), to: format(addMonths(start, 1), "yyyy-MM-dd") };
}

async function costsByClient() {
  const rows = await db
    .select({ clientId: invoices.clientId, total: sql<number>`coalesce(sum(${invoices.amountCents}), 0)` })
    .from(invoices)
    .groupBy(invoices.clientId);
  return new Map(rows.map((r) => [r.clientId, Number(r.total)]));
}

export async function getDashboard(month: string) {
  await requireUser();
  const { from, to } = monthRange(month);

  const [goal, monthClients, allClients, costs] = await Promise.all([
    db.query.goals.findFirst({ where: eq(goals.month, month) }),
    db
      .select()
      .from(clients)
      .where(and(gte(clients.closedAt, from), lt(clients.closedAt, to)))
      .orderBy(desc(clients.closedAt), desc(clients.createdAt)),
    db.select().from(clients),
    costsByClient(),
  ]);

  const contributions = monthClients.map((c) => ({ client: c, contribution: goalContribution(c) }));
  const progress = goalProgress(goal?.targetCents ?? 0, contributions.map((c) => c.contribution));

  let revenueMonth = 0;
  let costMonth = 0;
  for (const c of monthClients) {
    const r = clientResult(c, [{ amountCents: costs.get(c.id) ?? 0 }]);
    revenueMonth += r.revenueCents;
    costMonth += r.costCents;
  }

  // Histórico dos últimos 6 meses (atingido x meta)
  const months = Array.from({ length: 6 }, (_, i) =>
    format(addMonths(parse(month, "yyyy-MM", new Date()), i - 5), "yyyy-MM"),
  );
  const goalRows = await db.select().from(goals);
  const goalMap = new Map(goalRows.map((g) => [g.month, g.targetCents]));
  const history = months.map((m) => {
    const achieved = allClients.filter((c) => monthOf(c.closedAt) === m).reduce((s, c) => s + goalContribution(c), 0);
    return { month: m, achievedCents: achieved, targetCents: goalMap.get(m) ?? 0 };
  });

  return {
    month,
    goal: goal ?? null,
    progress,
    contributions,
    totals: {
      clients: monthClients.length,
      revenueCents: revenueMonth,
      costCents: costMonth,
      resultCents: revenueMonth - costMonth,
    },
    history,
  };
}

export async function listClients(query?: string) {
  await requireUser();
  const q = query?.trim();
  const rows = await db
    .select()
    .from(clients)
    .where(q ? or(like(clients.name, `%${q}%`), like(clients.document, `%${q}%`)) : undefined)
    .orderBy(desc(clients.closedAt), asc(clients.name));
  const costs = await costsByClient();
  return rows.map((c) => ({
    ...c,
    contribution: goalContribution(c),
    result: clientResult(c, [{ amountCents: costs.get(c.id) ?? 0 }]),
  }));
}

export async function getClient(id: string) {
  await requireUser();
  const client = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!client) return null;

  const [versions, clientInvoices, clientFiles, people] = await Promise.all([
    db.select().from(proposalVersions).where(eq(proposalVersions.clientId, id)).orderBy(desc(proposalVersions.version)),
    db.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.issueDate)),
    db.select().from(files).where(eq(files.clientId, id)).orderBy(desc(files.createdAt)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);

  const names = new Map(people.map((p) => [p.id, p.name]));
  const fileMap = new Map(clientFiles.map((f) => [f.id, f]));

  return {
    client,
    contribution: goalContribution(client),
    result: clientResult(client, clientInvoices),
    versions: versions.map((v) => ({
      ...v,
      author: v.createdBy ? (names.get(v.createdBy) ?? "—") : "—",
      file: v.fileId ? (fileMap.get(v.fileId) ?? null) : null,
      contribution: goalContribution(v),
    })),
    invoices: clientInvoices.map((i) => ({ ...i, file: i.fileId ? (fileMap.get(i.fileId) ?? null) : null })),
    files: clientFiles,
  };
}

export async function listGoals() {
  await requireUser();
  const [goalRows, allClients] = await Promise.all([
    db.select().from(goals).orderBy(desc(goals.month)),
    db.select().from(clients),
  ]);
  return goalRows.map((g) => {
    const achieved = allClients.filter((c) => monthOf(c.closedAt) === g.month).reduce((s, c) => s + goalContribution(c), 0);
    return { ...g, progress: goalProgress(g.targetCents, [achieved]) };
  });
}

export async function getFile(id: string) {
  await requireUser();
  return db.query.files.findFirst({ where: eq(files.id, id) });
}
