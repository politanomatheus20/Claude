/**
 * Proposta comercial automatizada — dados variáveis do "Modelo Mestre.docx".
 * Funções puras (sem I/O): montam número, datas e as tabelas de investimento
 * a partir das licenças da calculadora. O layout/texto fixo do PDF fica em
 * src/app/(app)/calculadora/proposal-pdf.tsx.
 */

import { addDays, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LICENSE_CALC_MONTHS } from "./calc";

export type Billing = "mensal" | "anual";

export interface ProposalSigner {
  id: string;
  name: string;
  role: string;
  email: string;
}

/** Contatos que podem assinar a proposta (página "Conclusão"). */
export const PROPOSAL_SIGNERS: readonly ProposalSigner[] = [
  { id: "robson", name: "Robson Soares Siqueira", role: "Diretor Governo & Qualidade", email: "Robson.siqueira@grupodata.com.br" },
  { id: "caio", name: "Caio Pasqualucci", role: "Diretor Privado", email: "caio.p@grupodata.com.br" },
  { id: "kleber", name: "Kleber Benedito da Silva", role: "Diretor Privado", email: "Kleber.silva@grupodata.com.br" },
];
export const DEFAULT_SIGNER_IDS = ["robson", "caio"] as const;

/** Serviços opcionais do modelo (valores padrão editáveis). */
export const DEFAULT_IMPLANTATION_CENTS = 28_000_00;
export const DEFAULT_TRAINING_CENTS = 6_500_00;

/** Validade da proposta, em dias corridos (texto do modelo). */
export const PROPOSAL_VALIDITY_DAYS = 30;

export interface ProposalLicense {
  name: string;
  quantity: number;
  /** Valor unitário mensal por licença ao cliente (o da calculadora). */
  unitPriceCents: number;
}

export interface ProposalOptional {
  included: boolean;
  cents: number;
}

export interface ProposalInput {
  clientName: string;
  contactName: string;
  /** Vazio = gerado automaticamente (CLIENTE + AAAAMMDD). */
  number: string;
  revision: string;
  /** Data de emissão, AAAA-MM-DD. */
  issuedAt: string;
  billing: Billing;
  licenses: readonly ProposalLicense[];
  /** Suporte mensal (pela quantidade total de licenças). */
  supportMonthlyCents: number;
  implantation: ProposalOptional;
  training: ProposalOptional;
  signers: readonly ProposalSigner[];
}

export interface InvestmentRow {
  item: number;
  object: string;
  quantity: string;
  unit: string;
  /** Centavos; null = "Cortesia". */
  unitCents: number | null;
  totalCents: number | null;
}

/** "Hipercon Ltda." → "HIPERCONLTDA" (sem acentos, espaços ou símbolos). */
export function clientSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Nº da proposta no padrão do modelo: CLIENTE + AAAAMMDD (ex.: ETPS20261117). */
export function defaultProposalNumber(clientName: string, issuedAt: string) {
  return `${clientSlug(clientName)}${issuedAt.replace(/-/g, "")}`;
}

const parseIso = (iso: string) => parse(iso, "yyyy-MM-dd", new Date());

/** "São Paulo, 17 de novembro de 2026". */
export function longDate(iso: string) {
  return `São Paulo, ${format(parseIso(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
}

export function validUntil(iso: string) {
  return format(addDays(parseIso(iso), PROPOSAL_VALIDITY_DAYS), "yyyy-MM-dd");
}

export const isValidIsoDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parseIso(iso).getTime());

/** Monta as tabelas "Licenciamento e Suporte" e "Serviços Opcionais" do Investimento Consolidado. */
export function buildInvestment(input: Pick<ProposalInput, "billing" | "licenses" | "supportMonthlyCents" | "implantation" | "training">) {
  const anual = input.billing === "anual";
  const licenses = input.licenses.filter((l) => l.quantity > 0);
  const totalQuantity = licenses.reduce((s, l) => s + l.quantity, 0);
  const recurring: InvestmentRow[] = [];
  let item = 1;

  for (const l of licenses) {
    const unitCents = anual ? l.unitPriceCents * LICENSE_CALC_MONTHS : l.unitPriceCents;
    recurring.push({
      item: item++,
      object: anual ? `Licenciamento anual – ${l.name} (${brl(l.unitPriceCents)}/usuário/mês)` : `Licenciamento ${l.name}`,
      quantity: String(l.quantity),
      unit: "Licença",
      unitCents,
      totalCents: unitCents * l.quantity,
    });
  }
  if (input.supportMonthlyCents > 0) {
    recurring.push({
      item: item++,
      object: "Suporte Contínuo Consultivo 24/7",
      quantity: anual ? String(LICENSE_CALC_MONTHS) : "1",
      unit: anual ? "Mensalidade" : "Mensal",
      unitCents: input.supportMonthlyCents,
      totalCents: input.supportMonthlyCents * (anual ? LICENSE_CALC_MONTHS : 1),
    });
  }
  recurring.push(
    { item: item++, object: "Governança de IA – Data Omnis", quantity: String(totalQuantity), unit: "Licença", unitCents: null, totalCents: null },
    { item: item++, object: "Implantação do Sistema Claude (Kickoff)", quantity: "1", unit: "Serviço", unitCents: null, totalCents: null },
  );

  const optional: InvestmentRow[] = [];
  if (input.implantation.included) {
    optional.push({
      item: item++,
      object: "Consultoria de governança e adoção em IA / Implantação Avançada Enterprise & Omnis",
      quantity: "1",
      unit: "Serviço",
      unitCents: input.implantation.cents,
      totalCents: input.implantation.cents,
    });
  }
  if (input.training.included) {
    optional.push({ item: item++, object: "Treinamento Claude", quantity: "1", unit: "Workshop", unitCents: input.training.cents, totalCents: input.training.cents });
  }

  const sum = (rows: InvestmentRow[]) => rows.reduce((s, r) => s + (r.totalCents ?? 0), 0);
  return {
    totalQuantity,
    recurring,
    recurringTotalCents: sum(recurring),
    recurringTotalLabel: anual ? `Total estimado (${LICENSE_CALC_MONTHS} meses):` : "Total estimado (mensal):",
    optional,
    optionalTotalCents: sum(optional),
  };
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "R$ 1.234,56" (com espaço normal — fontes de PDF não têm o espaço especial do Intl). */
export const brl = (cents: number) => brlFmt.format(cents / 100).replace(/ /g, " ");
/** "1.234,56" — células de tabela (a coluna já diz "R$"). */
export const brlPlain = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dados prontos para o PDF. */
export function buildProposal(input: ProposalInput) {
  const issuedAt = input.issuedAt;
  return {
    clientName: input.clientName.trim(),
    contactName: input.contactName.trim(),
    number: input.number.trim() || defaultProposalNumber(input.clientName, issuedAt),
    revision: input.revision.trim(),
    issuedLabel: longDate(issuedAt),
    validUntilLabel: longDate(validUntil(issuedAt)),
    billing: input.billing,
    supportMonthlyCents: input.supportMonthlyCents,
    trainingCents: input.training.cents,
    trainingIncluded: input.training.included,
    implantationIncluded: input.implantation.included,
    signers: input.signers,
    investment: buildInvestment(input),
  };
}

export type ProposalData = ReturnType<typeof buildProposal>;

/** Nome do arquivo no padrão usado hoje: "Proposta Comercial - Nº - Rev - Cliente.pdf". */
export function proposalFileName(p: Pick<ProposalData, "number" | "revision" | "clientName">) {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${["Proposta Comercial", safe(p.number), safe(p.revision), safe(p.clientName)].filter(Boolean).join(" - ")}.pdf`;
}

/** O que falta para gerar a proposta (vazio = pronto). */
export function proposalProblems(input: ProposalInput) {
  const problems: string[] = [];
  if (!input.clientName.trim()) problems.push("Informe o nome do cliente.");
  if (!isValidIsoDate(input.issuedAt)) problems.push("Informe a data de emissão.");
  if (!input.licenses.some((l) => l.quantity > 0)) problems.push("Informe a quantidade de licenças na calculadora.");
  if (input.signers.length === 0) problems.push("Escolha pelo menos um contato para assinar.");
  return problems;
}
