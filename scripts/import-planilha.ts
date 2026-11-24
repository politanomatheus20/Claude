/**
 * Importa a planilha "CLAUDE DATAGROUP 2026" (.xlsx) para o banco e confere,
 * linha a linha, se o sistema reproduz exatamente os valores calculados pela planilha.
 *
 *   npm run import:planilha -- "<caminho>.xlsx" --check     # só confere, não grava
 *   npm run import:planilha -- "<caminho>.xlsx"             # importa (banco vazio)
 *   npm run import:planilha -- "<caminho>.xlsx" --replace   # apaga clientes/contratos e reimporta
 *
 * Os dados dos clientes NÃO vão para o Git: ficam apenas no banco.
 */
import ExcelJS from "exceljs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/db/schema";
import { databaseTokenFromEnv, databaseUrlFromEnv } from "../src/lib/env";
import { computeContract, type ContractValues } from "../src/lib/calc";
import type { BillingStatus, LicenseStatus, NewContract, PaymentType, Sector } from "../src/lib/db/schema";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const CHECK_ONLY = args.includes("--check");
const REPLACE = args.includes("--replace");
if (!file) {
  console.error('Uso: npm run import:planilha -- "<arquivo>.xlsx" [--check] [--replace]');
  process.exit(1);
}

// Colunas da planilha (1 = A)
const COL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20, U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26, AA: 27, AB: 28, AC: 29, AD: 30, AE: 31, AF: 32, AG: 33, AH: 34, AI: 35, AJ: 36 } as const;
type ColName = keyof typeof COL;

interface Cell {
  value: unknown; // valor final (resultado da fórmula, quando houver)
  formula: string | null;
}

function readCell(row: ExcelJS.Row, col: ColName): Cell {
  const v = row.getCell(COL[col]).value as unknown;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    if ("formula" in o || "sharedFormula" in o) {
      return { value: o.result ?? null, formula: String(o.formula ?? o.sharedFormula ?? "") };
    }
    if ("hyperlink" in o) return { value: o.text ?? String(o.hyperlink).replace(/^mailto:/, ""), formula: null };
    if ("richText" in o) return { value: (o.richText as { text: string }[]).map((t) => t.text).join(""), formula: null };
    if ("error" in o) return { value: null, formula: null };
  }
  return { value: v ?? null, formula: null };
}

const text = (c: Cell) => {
  if (c.value === null || c.value === undefined) return null;
  const s = String(c.value).trim();
  return s ? s : null;
};

/** Número de célula (aceita "R$ 1.242,00"). */
function num(c: Cell): number | null {
  if (typeof c.value === "number") return c.value;
  if (typeof c.value === "string") {
    const raw = c.value.replace(/[^\d,.-]/g, "");
    if (!raw) return null;
    const v = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

const cents = (v: number | null) => (v === null ? null : Math.round(v * 100));
const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

function isoDate(c: Cell): string | null {
  if (c.value instanceof Date) return c.value.toISOString().slice(0, 10);
  const s = text(c);
  if (!s) return null;
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{2})(\d{2})\/(\d{4})$/); // "1510/2026" → 15/10/2026
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

const looksLikeCode = (s: string | null) => !!s && !/\s/.test(s) && /\d/.test(s) && s === s.toUpperCase();

function mapStatus<T extends string>(s: string | null, fallback: T): T {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "ok") return "ok" as T;
  if (v.includes("errado")) return "valor_errado" as T;
  if (v.includes("pendente")) return "pendente" as T;
  return fallback;
}

interface Parsed {
  rowNumber: number;
  section: "principal" | "atualizacao";
  client: { name: string; sector: Sector; document: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null };
  contract: Omit<NewContract, "clientId">;
  expected: Partial<Record<"K" | "L" | "M" | "N" | "P" | "Q" | "R" | "S" | "T" | "AA" | "AC", number>>;
  warnings: string[];
}

function parseRow(row: ExcelJS.Row, section: Parsed["section"]): Parsed | null {
  const c = (k: ColName) => readCell(row, k);
  const code = text(c("A"));
  const rawName = text(c("B"));
  if (!code && !rawName) return null;
  const warnings: string[] = [];

  let name = rawName ?? code!;
  if (looksLikeCode(rawName) && code && !looksLikeCode(code)) name = code;
  if (looksLikeCode(name)) warnings.push(`nome parece um código ("${name}") — ajuste no sistema`);

  const K = c("K"), L = c("L"), M = c("M"), O = c("O"), P = c("P"), Q = c("Q"), R = c("R"), S = c("S");
  const kText = text(K)?.toLowerCase();
  const xText = text(c("X"))?.toLowerCase();
  const paymentType: PaymentType = xText === "anual" || xText === "mensal" ? xText : kText === "anual" || !num(K) ? "anual" : "mensal";

  // K/L — valor mensal/anual ao cliente
  const kNum = K.formula ? null : num(K);
  const lNum = num(L) ?? 0;
  const licensesMonthlyCents = kNum === null ? null : cents(kNum);
  const licensesAnnualOverrideCents = kNum !== null && same(lNum, kNum * 12) ? null : cents(lNum);
  const annual = licensesAnnualOverrideCents !== null ? lNum : (kNum ?? 0) * 12;

  // M — imposto
  const mNum = num(M) ?? annual * 0.12;
  const taxOverrideCents = same(mNum, annual * 0.12) ? null : cents(mNum);

  // O/P — custo Claude
  const oNum = O.formula ? null : num(O);
  const pNum = num(P) ?? 0;
  const claudeMonthlyCents = oNum === null ? null : cents(oNum);
  const claudeAnnualOverrideCents = oNum !== null && same(pNum, oNum * 12) ? null : cents(pNum);
  const pEff = claudeAnnualOverrideCents !== null ? pNum : (oNum ?? 0) * 12;

  // Q/R — IOF e total
  const qNum = num(Q) ?? pEff * 0.035;
  const iofOverrideCents = same(qNum, pEff * 0.035) ? null : cents(qNum);
  const rNum = num(R) ?? pEff + qNum;
  const licenseTotalOverrideCents = same(rNum, pEff + qNum) ? null : cents(rNum);

  // S — consultoria → suporte / treinamento
  const sNum = num(S) ?? 0;
  const action = text(c("U"));
  const isTraining = /treinamento/i.test(action ?? "");
  let supportCents = 0;
  let trainingCents = 0;
  if (isTraining) trainingCents = cents(sNum)!;
  else if (paymentType === "mensal") {
    supportCents = Math.round((sNum * 100) / 12);
    if (!same(supportCents * 12, sNum * 100)) warnings.push(`consultoria ${sNum} não divide exatamente por 12`);
  } else supportCents = cents(sNum)!;

  // Financeiro
  const installments = num(c("Z"));
  const zEff = installments ?? (paymentType === "anual" ? 1 : 12);
  const aaNum = num(c("AA"));
  const installmentOverrideCents = aaNum === null || same(aaNum, annual / zEff) ? null : cents(aaNum);
  const receivedCents = cents(num(c("AB"))) ?? 0;

  // Telefone: a planilha guarda como fórmula "=+55 ..." (gera #ERROR!)
  const AJ = c("AJ");
  const contactPhone = AJ.formula ? AJ.formula.replace(/^=/, "").trim() : text(AJ);

  const sectorText = text(c("C"))?.toLowerCase();
  const expected: Parsed["expected"] = {};
  for (const k of ["L", "M", "N", "P", "Q", "R", "S", "T"] as const) {
    const v = num(c(k));
    if (v !== null) expected[k] = v;
  }
  const kv = num(K);
  if (kv !== null) expected.K = kv;
  if (aaNum !== null) expected.AA = aaNum;
  const ac = num(c("AC"));
  if (ac !== null) expected.AC = ac;

  return {
    rowNumber: row.number,
    section,
    client: {
      name,
      sector: sectorText === "governo" ? "governo" : "privado",
      document: text(c("D")),
      contactName: text(c("AH")),
      contactEmail: text(c("AI")),
      contactPhone,
    },
    contract: {
      kind: section,
      code,
      description: text(c("E")),
      signedAt: isoDate(c("F")),
      startAt: isoDate(c("G")),
      endAt: isoDate(c("H")),
      quantity: num(c("I")),
      paymentType,
      proposal2027MonthlyCents: J(c("J")),
      licensesMonthlyCents,
      licensesAnnualOverrideCents,
      taxOverrideCents,
      claudeMonthlyCents,
      claudeAnnualOverrideCents,
      iofOverrideCents,
      licenseTotalOverrideCents,
      supportCents,
      trainingCents,
      action,
      billingStatus: mapStatus<BillingStatus>(text(c("V")), "pendente"),
      licenseStatus: mapStatus<LicenseStatus>(text(c("W")), "pendente"),
      owner: text(c("AG")),
      paymentMethod: text(c("Y")),
      installments,
      installmentOverrideCents,
      receivedCents,
    },
    expected,
    warnings,
  };
}

function J(c: Cell) {
  return typeof c.value === "number" ? cents(c.value) : null;
}

function toValues(ct: Parsed["contract"]): ContractValues {
  return {
    paymentType: ct.paymentType,
    licensesMonthlyCents: ct.licensesMonthlyCents ?? null,
    licensesAnnualOverrideCents: ct.licensesAnnualOverrideCents ?? null,
    taxOverrideCents: ct.taxOverrideCents ?? null,
    claudeMonthlyCents: ct.claudeMonthlyCents ?? null,
    claudeAnnualOverrideCents: ct.claudeAnnualOverrideCents ?? null,
    iofOverrideCents: ct.iofOverrideCents ?? null,
    licenseTotalOverrideCents: ct.licenseTotalOverrideCents ?? null,
    supportCents: ct.supportCents ?? 0,
    trainingCents: ct.trainingCents ?? 0,
    installments: ct.installments ?? null,
    installmentOverrideCents: ct.installmentOverrideCents ?? null,
    receivedCents: ct.receivedCents ?? 0,
    endAt: ct.endAt ?? null,
  };
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file!);
  const ws = wb.worksheets[0];

  const parsed: Parsed[] = [];
  let section: Parsed["section"] = "principal";
  ws.eachRow({ includeEmpty: false }, (row) => {
    const b = text(readCell(row, "B")) ?? "";
    const a = text(readCell(row, "A")) ?? "";
    if (/atualiza/i.test(b)) {
      section = "atualizacao";
      return;
    }
    if (/^id\s*\/\s*n/i.test(a)) return; // cabeçalho
    const p = parseRow(row, section);
    if (p) parsed.push(p);
  });

  // ---------- Conferência linha a linha ----------
  const map = { K: "monthly", L: "annual", M: "tax", N: "net", P: "claudeAnnual", Q: "iof", R: "licenseTotal", S: "consulting", T: "result", AA: "installmentValue", AC: "balanceDue" } as const;
  let checked = 0;
  const mismatches: string[] = [];
  for (const p of parsed) {
    const out = computeContract(toValues(p.contract));
    for (const [col, expected] of Object.entries(p.expected) as [keyof typeof map, number][]) {
      const got = out[map[col]] / 100;
      checked++;
      if (Math.abs(got - expected) >= 0.005) {
        mismatches.push(`  linha ${p.rowNumber} (${p.client.name}) ${col}: planilha ${expected.toFixed(4)} · sistema ${got.toFixed(4)}`);
      }
    }
  }

  const principal = parsed.filter((p) => p.section === "principal").length;
  console.log(`\nPlanilha: ${parsed.length} linhas (${principal} contratos, ${parsed.length - principal} atualizações)`);
  console.log(`Conferência: ${checked} valores comparados, ${mismatches.length} divergências`);
  if (mismatches.length) console.log(mismatches.join("\n"));
  const warnings = parsed.flatMap((p) => p.warnings.map((w) => `  linha ${p.rowNumber}: ${w}`));
  if (warnings.length) console.log(`Avisos:\n${warnings.join("\n")}`);

  if (CHECK_ONLY) {
    process.exit(mismatches.length ? 1 : 0);
  }
  if (mismatches.length) {
    console.error("\nImportação cancelada: há divergências.");
    process.exit(1);
  }

  // ---------- Gravação ----------
  const client = createClient({ url: databaseUrlFromEnv() ?? "file:./data/app.db", authToken: databaseTokenFromEnv() });
  const db = drizzle(client, { schema });

  const existing = await db.select({ id: schema.clients.id }).from(schema.clients).limit(1);
  if (existing.length && !REPLACE) {
    console.error("\nO banco já tem clientes. Use --replace para apagar e reimportar.");
    process.exit(1);
  }

  // Agrupa clientes por CNPJ, senão por código do contrato / nome.
  const keyOf = (p: Parsed) => p.client.document ?? p.client.name.trim().toLowerCase();
  const codeToKey = new Map<string, string>();
  for (const p of parsed) if (p.section === "principal" && p.contract.code) codeToKey.set(p.contract.code.trim(), keyOf(p));

  const groups = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const key = (p.section === "atualizacao" && p.contract.code && codeToKey.get(p.contract.code.trim())) || keyOf(p);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  await db.transaction(async (tx) => {
    if (REPLACE) {
      await tx.delete(schema.invoices);
      await tx.delete(schema.files);
      await tx.delete(schema.contractVersions);
      await tx.delete(schema.contracts);
      await tx.delete(schema.clients);
    }
    for (const rows of groups.values()) {
      const first = rows.find((r) => r.section === "principal") ?? rows[0];
      const pick = <K extends keyof Parsed["client"]>(k: K) => rows.map((r) => r.client[k]).find(Boolean) ?? null;
      const [cl] = await tx
        .insert(schema.clients)
        .values({
          name: first.client.name,
          sector: first.client.sector,
          document: pick("document"),
          contactName: pick("contactName"),
          contactEmail: pick("contactEmail"),
          contactPhone: pick("contactPhone"),
        })
        .returning();
      for (const r of rows) {
        const [ct] = await tx.insert(schema.contracts).values({ ...r.contract, clientId: cl.id }).returning();
        await tx.insert(schema.contractVersions).values({
          contractId: ct.id,
          version: 1,
          snapshot: { ...r.contract },
          reason: `Importado da planilha (linha ${r.rowNumber})`,
        });
      }
    }
  });

  console.log(`\nImportado: ${groups.size} clientes, ${parsed.length} contratos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
