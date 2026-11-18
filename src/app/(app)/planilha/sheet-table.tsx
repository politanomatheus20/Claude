"use client";

import Link from "next/link";
import { Check, Download, ExternalLink, Loader2, Maximize2, Minimize2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { updateSheetCell } from "@/app/actions";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { computeContract, type ContractComputed } from "@/lib/calc";
import type { Client, Contract } from "@/lib/db/schema";
import { centsToInput, date, money } from "@/lib/format";
import { billingLabel, financialLabel, licenseLabel, sectorLabel, termLabel } from "@/lib/labels";
import { applySheetEdit, parseSheetValue, type SheetField } from "@/lib/sheet-edit";
import { cn } from "@/lib/utils";

export interface SheetRowData {
  contract: Contract;
  client: Client;
}
interface X extends SheetRowData {
  calc: ContractComputed;
}

type Kind = "text" | "money" | "int" | "date" | "enum" | "calc";
interface Col {
  key: string;
  title: string;
  group: string;
  kind: Kind;
  /** Campo editável (ausente = calculado). */
  field?: SheetField;
  width: number;
  /** Valor numérico (centavos ou número) — alinhamento, totais e CSV. */
  num?: (x: X) => number | null;
  /** Texto exibido. */
  text?: (x: X) => string;
  render?: (x: X) => React.ReactNode;
  /** Valor inicial do editor. */
  draft?: (x: X) => string;
  manual?: (x: X) => boolean;
  muted?: (x: X) => boolean;
  tone?: (x: X) => string | undefined;
  sum?: boolean;
  isMoney?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
}

const toDraft = (v: number | null | undefined) => (v === null || v === undefined ? "" : centsToInput(Math.round(v)));
const opts = (o: Record<string, { label: string } | string>) => Object.entries(o).map(([value, l]) => ({ value, label: typeof l === "string" ? l : l.label }));

/** Colunas de dinheiro: exibe/edita/soma a partir do mesmo valor. */
const moneyCol = (c: Omit<Col, "kind" | "isMoney"> & { num: (x: X) => number | null; kind?: Kind }): Col => ({
  kind: "money",
  isMoney: true,
  draft: c.field ? (x) => toDraft(c.num(x)) : undefined,
  ...c,
});

const COLS: Col[] = [
  { key: "A", group: "Cliente", title: "ID / nº contrato", kind: "text", field: "code", width: 200, text: (x) => x.contract.code ?? "" },
  { key: "C", group: "Cliente", title: "Setor", kind: "enum", field: "sector", width: 100, text: (x) => sectorLabel[x.client.sector], draft: (x) => x.client.sector, options: opts(sectorLabel) },
  { key: "D", group: "Cliente", title: "CNPJ", kind: "text", field: "document", width: 160, text: (x) => x.client.document ?? "" },
  { key: "E", group: "Cliente", title: "O que foi vendido", kind: "text", field: "description", width: 260, text: (x) => x.contract.description ?? "" },
  { key: "F", group: "Vigência", title: "Assinatura", kind: "date", field: "signedAt", width: 120, text: (x) => (x.contract.signedAt ? date(x.contract.signedAt) : ""), draft: (x) => x.contract.signedAt ?? "" },
  { key: "G", group: "Vigência", title: "Início", kind: "date", field: "startAt", width: 120, text: (x) => (x.contract.startAt ? date(x.contract.startAt) : ""), draft: (x) => x.contract.startAt ?? "" },
  { key: "H", group: "Vigência", title: "Fim", kind: "date", field: "endAt", width: 120, text: (x) => (x.contract.endAt ? date(x.contract.endAt) : ""), draft: (x) => x.contract.endAt ?? "" },
  { key: "I", group: "Vigência", title: "Qtd", kind: "int", field: "quantity", width: 70, num: (x) => x.contract.quantity, draft: (x) => x.contract.quantity?.toString() ?? "" },
  moneyCol({ key: "J", group: "Receita · cliente", title: "Mensal 2027", field: "proposal2027MonthlyCents", width: 130, num: (x) => x.contract.proposal2027MonthlyCents }),
  moneyCol({
    key: "K", group: "Receita · cliente", title: "Valor mensal", field: "licensesMonthlyCents", width: 130, hint: "Digitado · vazio = L ÷ 12",
    num: (x) => x.calc.monthly, draft: (x) => toDraft(x.contract.licensesMonthlyCents), muted: (x) => x.contract.licensesMonthlyCents === null,
  }),
  moneyCol({
    key: "L", group: "Receita · cliente", title: "Valor anual", field: "licensesAnnualOverrideCents", width: 140, sum: true, hint: "Fórmula K × 12 · digite para fixar, Delete volta à fórmula",
    num: (x) => x.calc.annual, manual: (x) => x.contract.licensesAnnualOverrideCents !== null && x.contract.licensesMonthlyCents !== null,
  }),
  moneyCol({
    key: "M", group: "Receita · cliente", title: "Imposto NF", field: "taxOverrideCents", width: 130, sum: true, hint: "Fórmula L × 12% · Delete volta à fórmula",
    num: (x) => x.calc.tax, manual: (x) => x.contract.taxOverrideCents !== null,
  }),
  moneyCol({ key: "N", group: "Receita · cliente", title: "Valor líquido", kind: "calc", width: 140, sum: true, hint: "Calculado: L − M", num: (x) => x.calc.net }),
  moneyCol({ key: "O", group: "Custo · Claude", title: "Claude mensal", field: "claudeMonthlyCents", width: 130, num: (x) => x.contract.claudeMonthlyCents }),
  moneyCol({
    key: "P", group: "Custo · Claude", title: "Licença anual", field: "claudeAnnualOverrideCents", width: 140, sum: true, hint: "Fórmula O × 12 · Delete volta à fórmula",
    num: (x) => x.calc.claudeAnnual, manual: (x) => x.contract.claudeAnnualOverrideCents !== null && x.contract.claudeMonthlyCents !== null,
  }),
  moneyCol({
    key: "Q", group: "Custo · Claude", title: "IOF", field: "iofOverrideCents", width: 120, sum: true, hint: "Fórmula P × 3,5% · Delete volta à fórmula",
    num: (x) => x.calc.iof, manual: (x) => x.contract.iofOverrideCents !== null,
  }),
  moneyCol({
    key: "R", group: "Custo · Claude", title: "Total licença", field: "licenseTotalOverrideCents", width: 140, sum: true, hint: "Fórmula P + Q · Delete volta à fórmula",
    num: (x) => x.calc.licenseTotal, manual: (x) => x.contract.licenseTotalOverrideCents !== null,
  }),
  moneyCol({ key: "S", group: "Resultado", title: "Consultoria", field: "consulting", width: 130, sum: true, hint: "Suporte no ano + treinamento", num: (x) => x.calc.consulting }),
  moneyCol({
    key: "T", group: "Resultado", title: "Resultado", kind: "calc", width: 140, sum: true, hint: "Calculado: N − R + S", num: (x) => x.calc.result,
    tone: (x) => (x.calc.result < 0 ? "text-danger font-medium" : "text-jelly-teal font-medium"),
  }),
  { key: "U", group: "Status", title: "Ação", kind: "text", field: "action", width: 260, text: (x) => x.contract.action ?? "" },
  {
    key: "V", group: "Status", title: "Faturamento", kind: "enum", field: "billingStatus", width: 130, options: opts(billingLabel),
    text: (x) => billingLabel[x.contract.billingStatus].label, draft: (x) => x.contract.billingStatus,
    render: (x) => <Badge tone={billingLabel[x.contract.billingStatus].tone}>{billingLabel[x.contract.billingStatus].label}</Badge>,
  },
  {
    key: "W", group: "Status", title: "Licenças", kind: "enum", field: "licenseStatus", width: 110, options: opts(licenseLabel),
    text: (x) => licenseLabel[x.contract.licenseStatus].label, draft: (x) => x.contract.licenseStatus,
    render: (x) => <Badge tone={licenseLabel[x.contract.licenseStatus].tone}>{licenseLabel[x.contract.licenseStatus].label}</Badge>,
  },
  {
    key: "X", group: "Status", title: "Modalidade", kind: "enum", field: "paymentType", width: 110, options: [{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }],
    text: (x) => (x.contract.paymentType === "anual" ? "Anual" : "Mensal"), draft: (x) => x.contract.paymentType,
  },
  { key: "Y", group: "Financeiro", title: "Forma de pagamento", kind: "text", field: "paymentMethod", width: 160, text: (x) => x.contract.paymentMethod ?? "" },
  {
    key: "Z", group: "Financeiro", title: "Parcelas", kind: "int", field: "installments", width: 90, hint: "Vazio = 12 (mensal) ou 1 (anual)",
    num: (x) => x.calc.installments, draft: (x) => x.contract.installments?.toString() ?? "", muted: (x) => x.contract.installments === null,
  },
  moneyCol({
    key: "AA", group: "Financeiro", title: "Valor parcela", field: "installmentOverrideCents", width: 130, hint: "Fórmula L ÷ Z · Delete volta à fórmula",
    num: (x) => x.calc.installmentValue, manual: (x) => x.contract.installmentOverrideCents !== null,
  }),
  moneyCol({ key: "AB", group: "Financeiro", title: "Recebido", field: "receivedCents", width: 130, sum: true, num: (x) => x.contract.receivedCents }),
  moneyCol({ key: "AC", group: "Financeiro", title: "Saldo a receber", kind: "calc", width: 140, sum: true, hint: "Calculado: AA × Z − AB", num: (x) => x.calc.balanceDue }),
  {
    key: "AD", group: "Financeiro", title: "Vigência", kind: "calc", width: 110, hint: "Calculado pelo fim da vigência",
    text: (x) => termLabel[x.calc.termStatus].label, render: (x) => <Badge tone={termLabel[x.calc.termStatus].tone}>{termLabel[x.calc.termStatus].label}</Badge>,
  },
  { key: "AE", group: "Financeiro", title: "Dias até vencer", kind: "calc", width: 120, hint: "Calculado: H − hoje", num: (x) => x.calc.daysToExpire },
  {
    key: "AF", group: "Financeiro", title: "Situação financeira", kind: "calc", width: 150, hint: "Calculado pelo saldo",
    text: (x) => financialLabel[x.calc.financialStatus].label, render: (x) => <Badge tone={financialLabel[x.calc.financialStatus].tone}>{financialLabel[x.calc.financialStatus].label}</Badge>,
  },
  { key: "AG", group: "Contato", title: "Responsável", kind: "text", field: "owner", width: 200, text: (x) => x.contract.owner ?? "" },
  { key: "AH", group: "Contato", title: "Nome do contato", kind: "text", field: "contactName", width: 170, text: (x) => x.client.contactName ?? "" },
  { key: "AI", group: "Contato", title: "E-mail", kind: "text", field: "contactEmail", width: 230, text: (x) => x.client.contactEmail ?? "" },
  { key: "AJ", group: "Contato", title: "Telefone", kind: "text", field: "contactPhone", width: 160, text: (x) => x.client.contactPhone ?? "" },
];

const NAME_COL: Col = { key: "B", group: "", title: "Nome do cliente", kind: "text", field: "name", width: 220, text: (x) => x.client.name };
const ALL = [NAME_COL, ...COLS];
const GROUPS = COLS.reduce<{ title: string; span: number }[]>((acc, c) => {
  const last = acc[acc.length - 1];
  if (last && last.title === c.group) last.span++;
  else acc.push({ title: c.group, span: 1 });
  return acc;
}, []);
const groupStart = (i: number) => i === 0 || COLS[i - 1].group !== COLS[i].group;

/** Texto de uma célula (tela e cópia). */
function cellText(c: Col, x: X): string {
  if (c.text) return c.text(x);
  const v = c.num?.(x);
  if (v === null || v === undefined) return "";
  return c.isMoney ? money(v) : String(v);
}
/** Valor inicial do editor. */
const cellDraft = (c: Col, x: X) => (c.draft ? c.draft(x) : cellText(c, x));

type Pos = { row: number; col: number };

export function SheetTable({ initialRows }: { initialRows: SheetRowData[] }) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [modality, setModality] = useState("");
  const [only, setOnly] = useState("");
  const [full, setFull] = useState(false);
  const [active, setActive] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<{ pos: Pos; initial: string } | null>(null);
  const [saving, setSaving] = useState(0);
  const [, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  const computed: X[] = useMemo(() => rows.map((r) => ({ ...r, calc: computeContract(r.contract) })), [rows]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = computed.filter((x) => {
      if (s && ![x.contract.code, x.client.name, x.client.document, x.contract.description, x.contract.action, x.contract.owner, x.client.contactName].some((v) => v?.toLowerCase().includes(s))) return false;
      if (sector && x.client.sector !== sector) return false;
      if (modality && x.contract.paymentType !== modality) return false;
      if (only === "pendencias" && x.contract.billingStatus === "ok" && x.contract.licenseStatus === "ok") return false;
      if (only === "negativos" && x.calc.result >= 0) return false;
      if (only === "vencendo" && x.calc.termStatus !== "a_vencer" && x.calc.termStatus !== "vencido") return false;
      return true;
    });
    return [...list.filter((x) => x.contract.kind === "principal"), ...list.filter((x) => x.contract.kind === "atualizacao")];
  }, [computed, q, sector, modality, only]);
  const firstUpdate = visible.findIndex((x) => x.contract.kind === "atualizacao");

  // Busca/filtros mudam quais linhas aparecem em `visible` — a célula selecionada
  // (índice nesse array) apontaria para outra linha se não for limpa quando mudam.
  const filterKey = `${q} ${sector} ${modality} ${only}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setActive(null);
    setEditing(null);
  }

  const clamp = (p: Pos): Pos => ({
    row: Math.max(0, Math.min(visible.length - 1, p.row)),
    col: Math.max(0, Math.min(ALL.length - 1, p.col)),
  });

  /** Grava uma célula: recalcula na hora no navegador e salva no servidor. */
  function commit(pos: Pos, raw: string) {
    const x = visible[pos.row];
    const col = ALL[pos.col];
    if (!x || !col.field) return;
    if (raw.trim() === cellDraft(col, x).trim()) return;

    const field = col.field;
    const parsed = parseSheetValue(field, raw);
    if (!parsed.ok) return void toast.error(parsed.message);
    const applied = applySheetEdit(x.contract, field, parsed.value);
    if (!applied.ok) return void toast.error(applied.message);

    const snapshot = rows;
    const { contract: cp, client: clp } = applied.value;
    setRows((rs) =>
      rs.map((r) => ({
        contract: r.contract.id === x.contract.id ? { ...r.contract, ...cp } : r.contract,
        client: r.client.id === x.client.id ? { ...r.client, ...clp } : r.client,
      })),
    );

    setSaving((n) => n + 1);
    startTransition(async () => {
      try {
        const res = await updateSheetCell(x.contract.id, field, raw);
        if (!res.ok) {
          setRows(snapshot);
          toast.error(res.message);
          return;
        }
        setRows((rs) =>
          rs.map((r) => ({
            contract: r.contract.id === res.contract.id ? res.contract : r.contract,
            client: r.client.id === res.client.id ? res.client : r.client,
          })),
        );
      } catch {
        setRows(snapshot);
        toast.error("Não foi possível salvar. Verifique a conexão.");
      } finally {
        setSaving((n) => n - 1);
      }
    });
  }

  function startEdit(pos: Pos, typed?: string) {
    const x = visible[pos.row];
    const col = ALL[pos.col];
    if (!x || !col.field) return;
    setActive(pos);
    setEditing({ pos, initial: typed ?? cellDraft(col, x) });
  }

  /** Fim da edição (Enter/Tab/blur/Esc) — opcionalmente move a seleção. */
  function finishEdit(pos: Pos, value: string | null, nav?: [number, number]) {
    setEditing(null);
    if (value !== null) commit(pos, value);
    if (nav) setActive(clamp({ row: pos.row + nav[0], col: pos.col + nav[1] }));
    if (nav || value === null) gridRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!active) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${active.row}:${active.col}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editing && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, editing]);

  function onGridKey(e: React.KeyboardEvent) {
    if (editing || !active) return;
    const col = ALL[active.col];
    const nav: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (nav[e.key]) {
      e.preventDefault();
      setActive(clamp({ row: active.row + nav[e.key][0], col: active.col + nav[e.key][1] }));
    } else if (e.key === "Tab") {
      e.preventDefault();
      setActive(clamp({ row: active.row, col: active.col + (e.shiftKey ? -1 : 1) }));
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit(active);
    } else if ((e.key === "Delete" || e.key === "Backspace") && col.field) {
      e.preventDefault();
      commit(active, "");
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const x = visible[active.row];
      if (x) void navigator.clipboard?.writeText(cellText(col, x));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && col.field && ["text", "money", "int"].includes(col.kind)) {
      e.preventDefault();
      startEdit(active, e.key);
    }
  }

  const totals = useMemo(
    () => Object.fromEntries(ALL.filter((c) => c.sum).map((c) => [c.key, visible.reduce((s, x) => s + (c.num?.(x) ?? 0), 0)])) as Record<string, number>,
    [visible],
  );
  const goal = visible.reduce((s, x) => s + x.calc.goalContribution, 0);

  function exportCsv() {
    const header = ["Tipo", ...ALL.map((c) => `${c.key} · ${c.title}`)];
    const lines = visible.map((x) => [
      x.contract.kind === "principal" ? "Contrato" : "Atualização",
      ...ALL.map((c) => {
        const v = c.isMoney ? c.num?.(x) : null;
        // Dinheiro sai como número (1234,56) para o Excel somar.
        return v === null || v === undefined ? cellText(c, x) : (v / 100).toFixed(2).replace(".", ",");
      }),
    ]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `claude-datagroup-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = "inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium transition hover:bg-white/[0.08]";

  const content = (
    <div className={cn("flex flex-col gap-3", full ? "fixed inset-0 z-50 bg-abyss-deep p-3 sm:p-4" : "h-[calc(100svh-9.5rem)] min-h-[28rem] lg:h-[calc(100svh-2.5rem)]")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Planilha</h1>
          <span className="text-xs text-mist/40">{visible.length} linhas</span>
        </div>
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-abyss-deep/60 px-3 focus-within:border-jelly-teal/60 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-mist/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, CNPJ, ação…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mist/35" />
        </label>
        <div className="w-44">
          <Select className="h-9" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Setor">
            <option value="">Todos os setores</option>
            <option value="privado">Privado</option>
            <option value="governo">Governo</option>
          </Select>
        </div>
        <div className="w-40">
          <Select className="h-9" value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Modalidade">
            <option value="">Mensal e anual</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </Select>
        </div>
        <div className="w-48">
          <Select className="h-9" value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Filtro">
            <option value="">Todas as linhas</option>
            <option value="pendencias">Com pendência (V/W)</option>
            <option value="negativos">Resultado negativo</option>
            <option value="vencendo">Vencendo / vencidos</option>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-mist/45 md:inline-flex" aria-live="polite">
            {saving > 0 ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <Check className="size-3.5 text-jelly-teal" /> Tudo salvo
              </>
            )}
          </span>
          <button type="button" onClick={exportCsv} className={btn}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button type="button" onClick={() => setFull((f) => !f)} className={btn} title={full ? "Sair da tela cheia (Esc)" : "Tela cheia"}>
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            <span className="hidden sm:inline">{full ? "Sair" : "Tela cheia"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-mist/45">
        <span>
          Duplo clique, <Kbd>Enter</Kbd> ou comece a digitar para editar · <Kbd>Enter</Kbd>/<Kbd>Tab</Kbd> salva · <Kbd>Esc</Kbd> cancela · <Kbd>Delete</Kbd> limpa (volta à fórmula)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warn" /> digitado à mão
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-white/15" /> calculado
        </span>
        <span className="tabular ml-auto">
          Resultado <b className={(totals.T ?? 0) < 0 ? "text-danger" : "text-jelly-teal"}>{money(totals.T ?? 0)}</b> · na meta/mês <b className="text-mist/80">{money(goal)}</b>
        </span>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKey}
        className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-card)] border border-white/[0.08] bg-abyss shadow-[var(--shadow-card)] outline-none"
        role="grid"
        aria-label="Planilha de contratos"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-surface text-[10px] tracking-[0.12em] text-mist/40 uppercase">
              <th rowSpan={2} className="sticky left-0 z-10 border-r border-b border-white/[0.1] bg-surface px-3 text-left font-medium" style={{ minWidth: NAME_COL.width }}>
                <span className="font-mono text-mist/30">B</span> Nome do cliente
              </th>
              {GROUPS.map((g) => (
                <th key={g.title} colSpan={g.span} className="border-b border-l border-white/[0.07] px-3 py-1.5 text-left font-medium">
                  {g.title}
                </th>
              ))}
            </tr>
            <tr className="bg-surface text-xs text-mist/55">
              {COLS.map((c, i) => (
                <th
                  key={c.key}
                  title={c.hint}
                  style={{ minWidth: c.width }}
                  className={cn(
                    "border-b border-white/[0.1] px-3 py-2 font-medium whitespace-nowrap",
                    c.num ? "text-right" : "text-left",
                    groupStart(i) && "border-l border-l-white/[0.07]",
                    !c.field && "text-mist/40 italic",
                  )}
                >
                  <span className="mr-1 font-mono text-[10px] text-mist/30 not-italic">{c.key}</span>
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={ALL.length} className="px-5 py-16 text-center text-sm text-mist/45">
                  Nenhuma linha com esses filtros.
                </td>
              </tr>
            ) : null}
            {visible.map((x, ri) => (
              <RowView
                key={x.contract.id}
                x={x}
                ri={ri}
                divider={ri === firstUpdate}
                activeCol={active?.row === ri ? active.col : null}
                editing={editing?.pos.row === ri ? editing : null}
                onSelect={setActive}
                onEdit={startEdit}
                onFinish={finishEdit}
              />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-30">
            <tr className="bg-surface-2 font-medium">
              <td className="sticky left-0 z-10 border-t border-r border-white/[0.12] bg-surface-2 px-3 py-2 text-[11px] tracking-wide text-mist/60 uppercase">Total</td>
              {COLS.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "tabular border-t border-white/[0.12] px-3 py-2 text-right whitespace-nowrap",
                    groupStart(i) && "border-l border-l-white/[0.07]",
                    c.key === "T" && ((totals.T ?? 0) < 0 ? "text-danger" : "text-jelly-teal"),
                  )}
                >
                  {c.sum ? money(totals[c.key]) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
  // Tela cheia vai direto para o <body>, acima do menu lateral.
  return full ? createPortal(content, document.body) : content;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/10 px-1 font-sans">{children}</kbd>;
}

function RowView({
  x,
  ri,
  divider,
  activeCol,
  editing,
  onSelect,
  onEdit,
  onFinish,
}: {
  x: X;
  ri: number;
  divider: boolean;
  activeCol: number | null;
  editing: { pos: Pos; initial: string } | null;
  onSelect: (p: Pos) => void;
  onEdit: (p: Pos) => void;
  onFinish: (p: Pos, value: string | null, nav?: [number, number]) => void;
}) {
  return (
    <>
      {divider ? (
        <tr>
          <td className="sticky left-0 z-10 border-y border-white/[0.1] bg-[#1b2a28] px-3 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-jelly-teal uppercase">Atualização</td>
          <td colSpan={COLS.length} className="border-y border-white/[0.1] bg-jelly-teal/[0.07]" />
        </tr>
      ) : null}
      <tr className="group">
        {ALL.map((c, ci) => {
          const pos = { row: ri, col: ci };
          const isActive = activeCol === ci;
          const isEditing = editing?.pos.col === ci;
          const manual = c.manual?.(x);
          const sticky = ci === 0;
          return (
            <td
              key={c.key}
              data-cell={`${ri}:${ci}`}
              onMouseDown={() => onSelect(pos)}
              onDoubleClick={() => c.field && onEdit(pos)}
              title={manual ? `Valor digitado à mão. ${c.hint ?? ""}` : c.hint}
              className={cn(
                "relative h-9 border-b border-white/[0.05] px-3 whitespace-nowrap select-none",
                sticky ? "sticky left-0 z-10 border-r border-r-white/[0.1] bg-abyss font-medium group-hover:bg-surface" : "group-hover:bg-white/[0.025]",
                !sticky && groupStart(ci - 1) && "border-l border-l-white/[0.05]",
                c.num ? "tabular text-right" : "text-left",
                c.kind === "calc" && "bg-white/[0.02] text-mist/70",
                c.kind === "text" && !sticky && "max-w-[22rem] truncate text-mist/80",
                c.muted?.(x) && "text-mist/40",
                manual && "text-warn",
                c.tone?.(x),
                c.field ? "cursor-cell" : "cursor-default",
                isActive && !isEditing && "outline-2 -outline-offset-2 outline-jelly-teal",
              )}
            >
              {manual ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warn" aria-hidden="true" /> : null}
              {isEditing && editing ? (
                <Editor col={c} initial={editing.initial} onFinish={(v, nav) => onFinish(pos, v, nav)} />
              ) : sticky ? (
                <span className="flex items-center gap-1.5">
                  <span className="truncate" style={{ maxWidth: c.width - 40 }}>
                    {x.client.name}
                  </span>
                  <Link
                    href={`/clientes/${x.client.id}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="shrink-0 text-mist/30 opacity-0 transition group-hover:opacity-100 hover:text-jelly-teal"
                    title="Abrir cliente"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </span>
              ) : c.render ? (
                c.render(x)
              ) : (
                cellText(c, x) || <span className="text-mist/15">—</span>
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
}

/** Editor da célula. Garante um único "fim" (Enter, Tab, Esc ou clique fora). */
function Editor({ col, initial, onFinish }: { col: Col; initial: string; onFinish: (value: string | null, nav?: [number, number]) => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (v: string | null, nav?: [number, number]) => {
    if (done.current) return;
    done.current = true;
    onFinish(v, nav);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    if (e.key === "Enter") {
      e.preventDefault();
      finish(v, [1, 0]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      finish(v, [0, e.shiftKey ? -1 : 1]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    }
    e.stopPropagation();
  };
  const base = "absolute inset-0 z-20 h-full w-full bg-surface-2 px-3 text-[13px] text-mist outline-2 -outline-offset-2 outline-jelly-teal";

  if (col.kind === "enum") {
    return (
      <select
        autoFocus
        className={cn(base, "cursor-pointer")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          finish(e.target.value);
        }}
        onBlur={(e) => finish(e.target.value)}
        onKeyDown={onKey}
      >
        {col.options!.map((o) => (
          <option key={o.value} value={o.value} className="bg-abyss">
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      autoFocus
      type={col.kind === "date" ? "date" : "text"}
      inputMode={col.kind === "money" ? "decimal" : col.kind === "int" ? "numeric" : undefined}
      className={cn(base, (col.kind === "money" || col.kind === "int") && "tabular text-right")}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={onKey}
      onFocus={(e) => {
        if (col.kind !== "date") e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length);
      }}
    />
  );
}
