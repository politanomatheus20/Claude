import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeContract, goalContribution, goalMonthOf, goalProgress, type ContractValues } from "./calc";

/**
 * Valores fictícios, mas seguindo exatamente os padrões de fórmula da planilha.
 * A conferência com os dados reais é feita por `npm run import:planilha -- --check`.
 */

const base: ContractValues = {
  paymentType: "mensal",
  licensesMonthlyCents: null,
  licensesAnnualOverrideCents: null,
  taxOverrideCents: null,
  claudeMonthlyCents: null,
  claudeAnnualOverrideCents: null,
  iofOverrideCents: null,
  licenseTotalOverrideCents: null,
  supportCents: 0,
  trainingCents: 0,
  installments: null,
  installmentOverrideCents: null,
  receivedCents: 0,
  endAt: null,
};

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

describe("linha padrão (L = K×12, P = O×12)", () => {
  // K 1.000,00 · O 800,00 · suporte mensal 300,00
  const c = computeContract({ ...base, licensesMonthlyCents: 1_000_00, claudeMonthlyCents: 800_00, supportCents: 300_00 });

  it("L = K × 12", () => close(c.annual, 12_000_00));
  it("M = L × 12%", () => close(c.tax, 1_440_00));
  it("N = L − M", () => close(c.net, 10_560_00));
  it("P = O × 12", () => close(c.claudeAnnual, 9_600_00));
  it("Q = P × 3,5%", () => close(c.iof, 336_00));
  it("R = P + Q", () => close(c.licenseTotal, 9_936_00));
  it("S = suporte mensal × 12", () => close(c.consulting, 3_600_00));
  it("T = N − R + S", () => close(c.result, 10_560_00 - 9_936_00 + 3_600_00));
  it("meta = S ÷ 12", () => close(c.goalContribution, 300_00));
});

describe("valores digitados na planilha substituem a fórmula", () => {
  it("L digitado → K = L ÷ 12", () => {
    const c = computeContract({ ...base, licensesAnnualOverrideCents: 6_000_00 });
    close(c.monthly, 500_00);
    close(c.annual, 6_000_00);
  });

  it("M, P, Q e R digitados", () => {
    const c = computeContract({
      ...base,
      paymentType: "anual",
      licensesAnnualOverrideCents: 10_000_00,
      taxOverrideCents: 1_000_00,
      claudeAnnualOverrideCents: 7_000_00,
      iofOverrideCents: 300_00,
      licenseTotalOverrideCents: 7_500_00,
    });
    close(c.tax, 1_000_00);
    close(c.claudeAnnual, 7_000_00);
    close(c.iof, 300_00);
    close(c.licenseTotal, 7_500_00); // não é P + Q: vale o digitado
    close(c.result, 9_000_00 - 7_500_00);
  });

  it("não arredonda no meio do cálculo (igual ao Sheets)", () => {
    const c = computeContract({ ...base, paymentType: "anual", licensesAnnualOverrideCents: 1_112_83 });
    close(c.tax, 1_112_83 * 0.12); // 13.353,96 centavos, com fração
  });
});

describe("consultoria e meta", () => {
  it("anual: suporte informado no ano ÷ 12", () => {
    const c = { paymentType: "anual" as const, supportCents: 12_000_00, trainingCents: 0 };
    close(goalContribution(c), 1_000_00);
  });

  it("treinamento ÷ 12 soma na meta", () => {
    const c = { paymentType: "mensal" as const, supportCents: 0, trainingCents: 6_000_00 };
    close(goalContribution(c), 500_00);
  });

  it("licenças não entram na meta", () => {
    const c = computeContract({ ...base, licensesMonthlyCents: 99_999_00 });
    close(c.goalContribution, 0);
  });

  it("mês da meta: assinatura, senão início da vigência", () => {
    assert.equal(goalMonthOf({ signedAt: "2026-10-05", startAt: "2026-11-01" }), "2026-10");
    assert.equal(goalMonthOf({ signedAt: null, startAt: "2026-11-09" }), "2026-11");
    assert.equal(goalMonthOf({ signedAt: null, startAt: null }), null);
  });
});

describe("financeiro e vigência", () => {
  it("AA = L ÷ Z e AC = AA × Z − recebido", () => {
    const c = computeContract({ ...base, licensesMonthlyCents: 1_000_00, installments: 12, receivedCents: 2_000_00 });
    close(c.installmentValue, 1_000_00);
    close(c.balanceDue, 10_000_00);
    assert.equal(c.financialStatus, "a_receber");
  });

  it("parcela digitada (com desconto) prevalece", () => {
    const c = computeContract({ ...base, licensesMonthlyCents: 1_000_00, installments: 12, installmentOverrideCents: 750_00 });
    close(c.balanceDue, 9_000_00);
  });

  it("anual sem nº de parcelas = 1 parcela", () => {
    const c = computeContract({ ...base, paymentType: "anual", licensesAnnualOverrideCents: 5_000_00 });
    assert.equal(c.installments, 1);
    close(c.balanceDue, 5_000_00);
  });

  it("dias até vencer e situação da vigência", () => {
    const today = new Date(2026, 10, 17);
    assert.equal(computeContract({ ...base, endAt: "2026-11-27" }, today).daysToExpire, 10);
    assert.equal(computeContract({ ...base, endAt: "2026-11-27" }, today).termStatus, "a_vencer");
    assert.equal(computeContract({ ...base, endAt: "2027-11-17" }, today).termStatus, "ativo");
    assert.equal(computeContract({ ...base, endAt: "2026-11-01" }, today).termStatus, "vencido");
    assert.equal(computeContract(base, today).termStatus, "sem_data");
  });
});

describe("barra de progresso", () => {
  it("metade e fim", () => {
    const p = goalProgress(10_000_00, [2_000_00, 1_000_00]);
    assert.equal(p.remainingToHalfCents, 2_000_00);
    assert.equal(p.remainingCents, 7_000_00);
    assert.equal(p.ratio, 0.3);
  });

  it("limita em 100% e informa excedente", () => {
    const p = goalProgress(1_000_00, [1_500_00]);
    assert.equal(p.ratio, 1);
    assert.equal(p.exceededCents, 500_00);
  });

  it("meta zero não divide por zero", () => assert.equal(goalProgress(0, [100]).ratio, 0));
});
