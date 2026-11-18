import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const money = (cents: number) => brl.format(cents / 100);
export const moneyCompact = (cents: number) => brlCompact.format(cents / 100);
export const percent = (fraction: number | null) => (fraction === null ? "—" : pct.format(fraction));

/**
 * Texto digitado → número decimal. Entende o padrão brasileiro e o americano:
 * "1.234,56" · "1234,56" · "1234.56" · "1,234.56" · "5,4321" · "5.4321" · "1.000" (mil).
 * O separador que aparece por último é o decimal; um único ponto seguido de
 * exatamente 3 dígitos (sem vírgula) é milhar ("1.000"). Retorna null se inválido.
 */
export function parseDecimal(input: string): number | null {
  const raw = input.replace(/[^\d,.-]/g, "").trim();
  if (!raw || raw === "-") return null;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // os dois presentes: o último é o decimal
    normalized = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // só vírgula: uma = decimal; várias = milhar ("1,234,567")
    normalized = (raw.match(/,/g) ?? []).length > 1 ? raw.replace(/,/g, "") : raw.replace(",", ".");
  } else if (lastDot >= 0) {
    // só ponto: vários = milhar; um com 3 dígitos depois = milhar; senão decimal
    const dots = (raw.match(/\./g) ?? []).length;
    normalized = dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(raw) ? raw.replace(/\./g, "") : raw;
  } else normalized = raw;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** "1.234,56" | "1234.56" | "R$ 1.234" → centavos (inteiro). Retorna null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  const n = parseDecimal(input);
  return n === null ? null : Math.round(n * 100);
}

/** Centavos → "1.234,56" (para preencher inputs). */
export const centsToInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const date = (iso: string) => format(parse(iso.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");

const TZ = "America/Sao_Paulo";
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Data e hora sempre no horário de Brasília (o servidor pode estar em UTC). */
export const dateTime = (iso: string) => dateTimeFmt.format(new Date(iso)).replace(", ", " às ");

/** "2026-11" → "novembro de 2026" */
export const monthLabel = (month: string) =>
  format(parse(month, "yyyy-MM", new Date()), "MMMM 'de' yyyy", { locale: ptBR });

/** "novembro de 2026" → "Novembro de 2026" */
export const monthTitle = (month: string) => {
  const l = monthLabel(month);
  return l.charAt(0).toUpperCase() + l.slice(1);
};

export const monthShort = (month: string) => format(parse(month, "yyyy-MM", new Date()), "MMM/yy", { locale: ptBR });

/** "AAAA-MM-DD" de hoje no horário de Brasília. */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const currentMonth = () => today().slice(0, 7);

/** "AAAA-MM" com mês 01–12. */
export const isValidMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "matheus.gavioli@..." → "Matheus Gavioli" */
export function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
