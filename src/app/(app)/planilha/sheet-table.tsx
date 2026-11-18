"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { date, money } from "@/lib/format";
import { billingLabel, financialLabel, licenseLabel, sectorLabel, termLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BillingStatus, ContractKind, LicenseStatus, PaymentType, Sector } from "@/lib/db/schema";
import type { FinancialStatus, TermStatus } from "@/lib/calc";

export interface SheetRow {
  id: string;
  clientId: string;
  kind: ContractKind;
  A: string | null;
  B: string;
  C: Sector;
  D: string | null;
  E: string | null;
  F: string | null;
  G: string | null;
  H: string | null;
  I: number | null;
  J: number | null;
  K: number | null;
  L: number;
  M: number;
  N: number;
  O: number | null;
  P: number;
  Q: number;
  R: number;
  S: number;
  T: number;
  U: string | null;
  V: BillingStatus;
  W: LicenseStatus;
  X: PaymentType;
  Y: string | null;
  Z: number;
  AA: number;
  AB: number;
  AC: number;
  AD: TermStatus;
  AE: number | null;
  AF: FinancialStatus;
  AG: string | null;
  AH: string | null;
  AI: string | null;
  AJ: string | null;
  goal: number;
  manual: string[];
}

type Col = keyof Omit<SheetRow, "id" | "clientId" | "kind" | "manual" | "goal">;
type Kind = "text" | "date" | "money" | "num" | "badge";

interface ColumnDef {
  key: Col;
  title: string;
  kind: Kind;
  sum?: boolean;
  render?: (r: SheetRow) => React.ReactNode;
  csv?: (r: SheetRow) => string;
  width?: string;
}

const GROUPS: { title: string; cols: ColumnDef[] }[] = [
  {
    title: "Cliente",
    cols: [
      { key: "A", title: "ID / nº contrato", kind: "text", width: "min-w-48" },
      { key: "C", title: "Setor", kind: "text", render: (r) => sectorLabel[r.C], csv: (r) => sectorLabel[r.C] },
      { key: "D", title: "CNPJ", kind: "text", width: "min-w-36" },
      { key: "E", title: "O que foi vendido", kind: "text", width: "min-w-56" },
    ],
  },
  {
    title: "Vigência",
    cols: [
      { key: "F", title: "Assinatura", kind: "date" },
      { key: "G", title: "Início", kind: "date" },
      { key: "H", title: "Fim", kind: "date" },
      { key: "I", title: "Qtd", kind: "num" },
    ],
  },
  {
    title: "Receita · cliente",
    cols: [
      { key: "J", title: "Mensal 2027", kind: "money" },
      { key: "K", title: "Valor mensal", kind: "money" },
      { key: "L", title: "Valor anual", kind: "money", sum: true },
      { key: "M", title: "Imposto NF", kind: "money", sum: true },
      { key: "N", title: "Valor líquido", kind: "money", sum: true },
    ],
  },
  {
    title: "Custo · Claude",
    cols: [
      { key: "O", title: "Claude mensal", kind: "money" },
      { key: "P", title: "Licença anual", kind: "money", sum: true },
      { key: "Q", title: "IOF", kind: "money", sum: true },
      { key: "R", title: "Total licença", kind: "money", sum: true },
    ],
  },
  {
    title: "Resultado",
    cols: [
      { key: "S", title: "Consultoria", kind: "money", sum: true },
      { key: "T", title: "Resultado", kind: "money", sum: true },
    ],
  },
  {
    title: "Status",
    cols: [
      { key: "U", title: "Ação", kind: "text", width: "min-w-56" },
      { key: "V", title: "Faturamento", kind: "badge", render: (r) => <Badge tone={billingLabel[r.V].tone}>{billingLabel[r.V].label}</Badge>, csv: (r) => billingLabel[r.V].label },
      { key: "W", title: "Licenças", kind: "badge", render: (r) => <Badge tone={licenseLabel[r.W].tone}>{licenseLabel[r.W].label}</Badge>, csv: (r) => licenseLabel[r.W].label },
      { key: "X", title: "Modalidade", kind: "text", render: (r) => <span className="capitalize">{r.X}</span> },
    ],
  },
  {
    title: "Financeiro",
    cols: [
      { key: "Y", title: "Forma de pagamento", kind: "text" },
      { key: "Z", title: "Parcelas", kind: "num" },
      { key: "AA", title: "Valor parcela", kind: "money" },
      { key: "AB", title: "Recebido", kind: "money", sum: true },
      { key: "AC", title: "Saldo a receber", kind: "money", sum: true },
      { key: "AD", title: "Vigência", kind: "badge", render: (r) => <Badge tone={termLabel[r.AD].tone}>{termLabel[r.AD].label}</Badge>, csv: (r) => termLabel[r.AD].label },
      { key: "AE", title: "Dias até vencer", kind: "num" },
      { key: "AF", title: "Situação financeira", kind: "badge", render: (r) => <Badge tone={financialLabel[r.AF].tone}>{financialLabel[r.AF].label}</Badge>, csv: (r) => financialLabel[r.AF].label },
    ],
  },
  {
    title: "Responsável e contato",
    cols: [
      { key: "AG", title: "Responsável", kind: "text", width: "min-w-44" },
      { key: "AH", title: "Contato", kind: "text", width: "min-w-36" },
      { key: "AI", title: "E-mail", kind: "text" },
      { key: "AJ", title: "Telefone", kind: "text", width: "min-w-36" },
    ],
  },
];

const ALL_COLS = GROUPS.flatMap((g) => g.cols);
const SUM_KEYS = ALL_COLS.filter((c) => c.sum).map((c) => c.key);

function cellText(r: SheetRow, c: ColumnDef, forCsv = false): string {
  const v = r[c.key];
  if (v === null || v === undefined || v === "") return "";
  if (c.csv) return c.csv(r);
  // No CSV, dinheiro sai como número (1234,56) para o Excel somar.
  if (c.kind === "money") return forCsv ? ((v as number) / 100).toFixed(2).replace(".", ",") : money(v as number);
  if (c.kind === "date") return date(v as string);
  return String(v);
}

export function SheetTable({ rows }: { rows: SheetRow[] }) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [modality, setModality] = useState("");
  const [only, setOnly] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (s && ![r.A, r.B, r.D, r.E, r.U, r.AG, r.AH].some((v) => v?.toLowerCase().includes(s))) return false;
      if (sector && r.C !== sector) return false;
      if (modality && r.X !== modality) return false;
      if (only === "pendencias" && r.V === "ok" && r.W === "ok") return false;
      if (only === "negativos" && r.T >= 0) return false;
      if (only === "vencendo" && r.AD !== "a_vencer" && r.AD !== "vencido") return false;
      return true;
    });
  }, [rows, q, sector, modality, only]);

  const principal = filtered.filter((r) => r.kind === "principal");
  const updates = filtered.filter((r) => r.kind === "atualizacao");

  function exportCsv() {
    const header = ["Tipo", "Nome do cliente", ...ALL_COLS.map((c) => `${c.key} · ${c.title}`)];
    const lines = filtered.map((r) => [r.kind === "principal" ? "Contrato" : "Atualização", r.B, ...ALL_COLS.map((c) => cellText(r, c, true))]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-datagroup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-abyss-deep/60 px-3 focus-within:border-jelly-teal/60 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-mist/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, CNPJ, ação…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mist/35" />
        </label>
        <div className="w-44">
          <Select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Setor">
            <option value="">Todos os setores</option>
            <option value="privado">Privado</option>
            <option value="governo">Governo</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Modalidade">
            <option value="">Mensal e anual</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </Select>
        </div>
        <div className="w-48">
          <Select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Filtro">
            <option value="">Todas as linhas</option>
            <option value="pendencias">Com pendência (V/W)</option>
            <option value="negativos">Resultado negativo</option>
            <option value="vencendo">Vencendo / vencidos</option>
          </Select>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium transition hover:bg-white/[0.08]"
        >
          <Download className="size-4" />
          Exportar (Excel)
        </button>
      </div>

      <Table title="Contratos" rows={principal} />
      <Table title="Atualização" rows={updates} />
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: SheetRow[] }) {
  const totals = Object.fromEntries(SUM_KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] as number), 0)]));
  const goal = rows.reduce((s, r) => s + r.goal, 0);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-white/[0.07] bg-abyss shadow-[var(--shadow-card)]">
      <header className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {title} <span className="ml-1 text-sm font-normal text-mist/40">{rows.length}</span>
        </h2>
        <p className="tabular text-xs text-mist/45">
          Resultado <span className={cn("font-medium", totals.T < 0 ? "text-danger" : "text-jelly-teal")}>{money(totals.T)}</span> · na meta/mês{" "}
          <span className="font-medium text-mist/80">{money(goal)}</span>
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-mist/45">Nenhuma linha.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface text-[11px] tracking-wide text-mist/45 uppercase">
                <th rowSpan={2} className="sticky left-0 z-10 border-r border-b border-white/[0.08] bg-surface px-4 py-2 text-left font-medium">
                  <span className="font-mono text-mist/30">B</span> Nome do cliente
                </th>
                {GROUPS.map((g) => (
                  <th key={g.title} colSpan={g.cols.length} className="border-b border-l border-white/[0.06] px-3 py-2 text-left font-medium">
                    {g.title}
                  </th>
                ))}
              </tr>
              <tr className="bg-surface text-xs text-mist/55">
                {GROUPS.map((g) =>
                  g.cols.map((c, i) => (
                    <th
                      key={c.key}
                      className={cn(
                        "border-b border-white/[0.08] px-3 py-2 font-medium whitespace-nowrap",
                        c.kind === "money" || c.kind === "num" ? "text-right" : "text-left",
                        i === 0 && "border-l border-l-white/[0.06]",
                      )}
                    >
                      <span className="mr-1 font-mono text-[10px] text-mist/30">{c.key}</span>
                      {c.title}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group">
                  <td className="sticky left-0 z-10 max-w-64 border-r border-b border-white/[0.06] bg-abyss px-4 py-2.5 group-hover:bg-surface">
                    <Link href={`/clientes/${r.clientId}`} className="block truncate font-medium hover:text-jelly-teal" title={r.B}>
                      {r.B}
                    </Link>
                  </td>
                  {GROUPS.map((g) =>
                    g.cols.map((c, i) => {
                      const manual = r.manual.includes(c.key);
                      const isResult = c.key === "T";
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            "border-b border-white/[0.05] px-3 py-2.5 whitespace-nowrap group-hover:bg-white/[0.02]",
                            c.kind === "money" || c.kind === "num" ? "tabular text-right" : "",
                            c.width,
                            i === 0 && "border-l border-l-white/[0.05]",
                            manual && "text-warn",
                            isResult && (r.T < 0 ? "font-medium text-danger" : "font-medium text-jelly-teal"),
                            c.kind === "text" && "max-w-72 truncate text-mist/75",
                          )}
                          title={manual ? "Valor digitado (não segue a fórmula)" : c.kind === "text" ? cellText(r, c) : undefined}
                        >
                          {c.render ? c.render(r) : cellText(r, c) || <span className="text-mist/20">—</span>}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-surface-2 font-medium">
                <td className="sticky left-0 z-10 border-t border-r border-white/[0.1] bg-surface-2 px-4 py-2.5 text-xs tracking-wide text-mist/60 uppercase">Total</td>
                {GROUPS.map((g) =>
                  g.cols.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "tabular border-t border-white/[0.1] px-3 py-2.5 text-right whitespace-nowrap",
                        i === 0 && "border-l border-l-white/[0.05]",
                        c.key === "T" && (totals.T < 0 ? "text-danger" : "text-jelly-teal"),
                      )}
                    >
                      {c.sum ? money(totals[c.key]) : ""}
                    </td>
                  )),
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
