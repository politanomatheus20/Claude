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

/** "1.234,56" | "1234.56" | "R$ 1.234" → centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  const raw = input.replace(/[^\d,.-]/g, "").trim();
  if (!raw) return null;
  // Padrão BR: ponto é milhar, vírgula é decimal. Se não houver vírgula,
  // um único ponto seguido de 1–2 dígitos é tratado como decimal.
  let normalized: string;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(raw)) normalized = raw;
  else normalized = raw.replace(/\./g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Centavos → "1.234,56" (para preencher inputs). */
export const centsToInput = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const date = (iso: string) => format(parse(iso.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");

export const dateTime = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

/** "2026-11" → "novembro de 2026" */
export const monthLabel = (month: string) =>
  format(parse(month, "yyyy-MM", new Date()), "MMMM 'de' yyyy", { locale: ptBR });

/** "novembro de 2026" → "Novembro de 2026" */
export const monthTitle = (month: string) => {
  const l = monthLabel(month);
  return l.charAt(0).toUpperCase() + l.slice(1);
};

export const monthShort = (month: string) => format(parse(month, "yyyy-MM", new Date()), "MMM/yy", { locale: ptBR });

export const currentMonth = () => format(new Date(), "yyyy-MM");
export const today = () => format(new Date(), "yyyy-MM-dd");

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
