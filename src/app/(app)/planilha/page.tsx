import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listContracts } from "@/lib/data";
import { SheetTable, type SheetRow } from "./sheet-table";

export const metadata: Metadata = { title: "Planilha" };

export default async function SheetPage() {
  const rows = await listContracts();
  const data: SheetRow[] = rows.map((c) => ({
    id: c.id,
    clientId: c.clientId,
    kind: c.kind,
    A: c.code,
    B: c.client.name,
    C: c.client.sector,
    D: c.client.document,
    E: c.description,
    F: c.signedAt,
    G: c.startAt,
    H: c.endAt,
    I: c.quantity,
    J: c.proposal2027MonthlyCents,
    K: c.paymentType === "anual" && c.licensesMonthlyCents === null ? null : c.calc.monthly,
    L: c.calc.annual,
    M: c.calc.tax,
    N: c.calc.net,
    O: c.claudeMonthlyCents,
    P: c.calc.claudeAnnual,
    Q: c.calc.iof,
    R: c.calc.licenseTotal,
    S: c.calc.consulting,
    T: c.calc.result,
    U: c.action,
    V: c.billingStatus,
    W: c.licenseStatus,
    X: c.paymentType,
    Y: c.paymentMethod,
    Z: c.calc.installments,
    AA: c.calc.installmentValue,
    AB: c.receivedCents,
    AC: c.calc.balanceDue,
    AD: c.calc.termStatus,
    AE: c.calc.daysToExpire,
    AF: c.calc.financialStatus,
    AG: c.owner,
    AH: c.client.contactName,
    AI: c.client.contactEmail,
    AJ: c.client.contactPhone,
    goal: c.calc.goalContribution,
    manual: [
      c.licensesAnnualOverrideCents !== null && c.licensesMonthlyCents !== null ? "L" : null,
      c.taxOverrideCents !== null ? "M" : null,
      c.claudeAnnualOverrideCents !== null && c.claudeMonthlyCents !== null ? "P" : null,
      c.iofOverrideCents !== null ? "Q" : null,
      c.licenseTotalOverrideCents !== null ? "R" : null,
      c.installmentOverrideCents !== null ? "AA" : null,
    ].filter((x): x is string => x !== null),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Planilha"
        title="Visão planilha"
        description="Todas as colunas da planilha CLAUDE DATAGROUP 2026, calculadas pelo sistema. Valores em amarelo foram digitados à mão (não seguem a fórmula)."
      />
      <SheetTable rows={data} />
    </>
  );
}
