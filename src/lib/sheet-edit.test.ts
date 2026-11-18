import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeContract } from "./calc";
import type { Contract } from "./db/schema";
import { applySheetEdit, parseSheetValue } from "./sheet-edit";

const contract = {
  id: "c1",
  clientId: "x",
  kind: "principal",
  paymentType: "mensal",
  licensesMonthlyCents: 1_000_00,
  licensesAnnualOverrideCents: null,
  taxOverrideCents: null,
  claudeMonthlyCents: 800_00,
  claudeAnnualOverrideCents: null,
  iofOverrideCents: null,
  licenseTotalOverrideCents: null,
  supportCents: 300_00,
  trainingCents: 0,
  installments: null,
  installmentOverrideCents: null,
  receivedCents: 0,
  endAt: null,
} as unknown as Contract;

const edit = (field: Parameters<typeof applySheetEdit>[1], raw: string) => {
  const p = parseSheetValue(field, raw);
  assert.ok(p.ok);
  const a = applySheetEdit(contract, field, p.value);
  assert.ok(a.ok);
  return { ...contract, ...a.value.contract } as Contract;
};

describe("edição na planilha", () => {
  it("editar K recalcula L, M, N, T", () => {
    const c = computeContract(edit("licensesMonthlyCents", "2.000,00"));
    assert.equal(c.annual, 24_000_00);
    assert.equal(c.result, 24_000_00 * 0.88 - 800_00 * 12 * 1.035 + 300_00 * 12);
  });

  it("L igual a K × 12 continua sendo fórmula", () => {
    assert.equal(edit("licensesAnnualOverrideCents", "12.000,00").licensesAnnualOverrideCents, null);
  });

  it("L diferente vira ajuste manual; vazio volta à fórmula", () => {
    assert.equal(edit("licensesAnnualOverrideCents", "11.000,00").licensesAnnualOverrideCents, 11_000_00);
    assert.equal(edit("taxOverrideCents", "").taxOverrideCents, null);
  });

  it("S digitado vira ajuste exato, sem perder centavos", () => {
    const c = edit("consulting", "1.000,00");
    assert.equal(c.consultingOverrideCents, 1_000_00);
    assert.equal(c.supportCents, 300_00); // suporte não muda
    assert.equal(computeContract(c).consulting, 1_000_00);
    assert.ok(Math.abs(computeContract(c).goalContribution - 1_000_00 / 12) < 1e-9);
  });

  it("S igual à fórmula (ou vazio) volta à fórmula", () => {
    assert.equal(edit("consulting", "3.600,00").consultingOverrideCents, null);
    assert.equal(edit("consulting", "").consultingOverrideCents, null);
  });

  it("parcelas (Z) não aceita 0", () => {
    assert.equal(parseSheetValue("installments", "0").ok, false);
    assert.equal(parseSheetValue("installments", "1").ok, true);
  });

  it("trocar modalidade com S que não divide por 12 preserva S exato", () => {
    const anual = { ...contract, paymentType: "anual", supportCents: 1_000_00 } as Contract;
    const p = parseSheetValue("paymentType", "mensal");
    assert.ok(p.ok);
    const a = applySheetEdit(anual, "paymentType", p.value);
    assert.ok(a.ok);
    const c = { ...anual, ...a.value.contract } as Contract;
    assert.equal(computeContract(c).consulting, 1_000_00);
  });

  it("trocar modalidade preserva a consultoria anual", () => {
    const c = edit("paymentType", "anual");
    assert.equal(c.supportCents, 3_600_00);
    assert.equal(computeContract(c).consulting, 3_600_00);
  });

  it("valida entradas", () => {
    assert.equal(parseSheetValue("name", " ").ok, false);
    assert.equal(parseSheetValue("quantity", "1,5").ok, false);
    assert.deepEqual(parseSheetValue("endAt", "05/11/2027"), { ok: true, value: "2027-11-05" });
    assert.equal(parseSheetValue("contactEmail", "x@").ok, false);
  });
});
