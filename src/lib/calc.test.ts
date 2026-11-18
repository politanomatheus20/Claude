import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  computeAnnualLicenseRow,
  computeContract,
  computeMonthlyLicenseRow,
  goalContribution,
  goalMonthOf,
  goalProgress,
  monthlySupportAddon,
  sumAnnualLicenseRows,
  sumMonthlyLicenseRows,
  supportFeeFor,
  type ContractValues,
} from "./calc";

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

describe("calculadora de licenças — mensal", () => {
  // Custo US$ 25 · câmbio R$ 5 · 4 licenças · unitário R$ 171 (referência zero margem)
  const row = computeMonthlyLicenseRow({ name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 4, unitPriceCents: 171_00 }, 12);

  it("E = custo dólar × câmbio", () => close(row.unitCostCents, 125_00));
  it("F = E × 3,5% (IOF)", () => close(row.iofCents, 437.5));
  it("G = E + F", () => close(row.licenseCostCents, 125_00 + 437.5));
  it("I = G × quantidade", () => close(row.totalCostCents, (125_00 + 437.5) * 4));
  it("K = unitário × 12% (imposto)", () => close(row.taxCents, 20_52));
  it("L = unitário − K", () => close(row.netUnitCents, 150_48));
  it("M = quantidade × unitário", () => close(row.clientTotalCents, 684_00));
  it("N = quantidade × L", () => close(row.netTotalCents, 601_92));
  it("O = N − I (resultado)", () => close(row.resultCents, 601_92 - (125_00 + 437.5) * 4));
  it("P = O ÷ M (margem)", () => close(row.margin!, row.resultCents / 684_00));
  it("Q = M × meses", () => close(row.annualClientCents, 684_00 * 12));
  it("R = O × meses", () => close(row.annualResultCents, row.resultCents * 12));

  it("quantidade zero → resultado e margem zerados/nulos", () => {
    const zero = computeMonthlyLicenseRow({ name: "ChatGPT Business", usdCostCents: 20_00, fxRateCents: 5_00, quantity: 0, unitPriceCents: 168_00 }, 12);
    assert.equal(zero.totalCostCents, 0);
    assert.equal(zero.clientTotalCents, 0);
    assert.equal(zero.resultCents, 0);
    assert.equal(zero.margin, null);
    assert.equal(zero.annualClientCents, 0);
  });

  it("totais somam as linhas e recalculam a margem geral", () => {
    const b = computeMonthlyLicenseRow({ name: "ChatGPT Business", usdCostCents: 20_00, fxRateCents: 5_00, quantity: 2, unitPriceCents: 168_00 }, 12);
    const totals = sumMonthlyLicenseRows([row, b]);
    close(totals.clientTotalCents, row.clientTotalCents + b.clientTotalCents);
    close(totals.resultCents, row.resultCents + b.resultCents);
    close(totals.margin!, totals.resultCents / totals.clientTotalCents);
  });

  it("ajuste manual do custo da licença (G) substitui a fórmula e flui pro custo total (I)", () => {
    const r = computeMonthlyLicenseRow(
      { name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 4, unitPriceCents: 171_00, licenseCostOverrideCents: 150_00 },
      12,
    );
    close(r.licenseCostCents, 150_00);
    close(r.totalCostCents, 150_00 * 4);
  });

  it("ajuste manual do total cliente substitui quantidade × unitário e recalcula líquido/resultado", () => {
    const r = computeMonthlyLicenseRow(
      { name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 4, unitPriceCents: 171_00, clientTotalOverrideCents: 700_00 },
      12,
    );
    close(r.clientTotalCents, 700_00);
    close(r.netTotalCents, 700_00 - 700_00 * 0.12);
    close(r.resultCents, r.netTotalCents - r.totalCostCents);
    close(r.margin!, r.resultCents / 700_00);
  });

  it("suporte: taxa fixa por faixa de quantidade total de licenças", () => {
    assert.equal(supportFeeFor(0), 0);
    assert.equal(supportFeeFor(4), 0);
    assert.equal(supportFeeFor(5), 490_00);
    assert.equal(supportFeeFor(10), 490_00);
    assert.equal(supportFeeFor(11), 990_00);
    assert.equal(supportFeeFor(20), 990_00);
    assert.equal(supportFeeFor(21), 1_500_00);
    assert.equal(supportFeeFor(40), 1_500_00);
    assert.equal(supportFeeFor(41), 2_800_00);
    assert.equal(supportFeeFor(50), 2_800_00);
    assert.equal(supportFeeFor(51), 4_500_00);
    assert.equal(supportFeeFor(200), 4_500_00);
  });

  it("suporte líquido do imposto (12%)", () => {
    const addon = monthlySupportAddon(15);
    close(addon.supportCents, 990_00);
    close(addon.netSupportCents, 990_00 - 990_00 * 0.12);
  });
});

describe("calculadora de licenças — anual", () => {
  // Custo US$ 25 · câmbio R$ 5 · 6 licenças · 12 meses · unitário R$ 136 (referência zero margem)
  const row = computeAnnualLicenseRow({ name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 6, months: 12, unitPriceCents: 136_00 });

  it("E = custo dólar × câmbio", () => close(row.unitCostCents, 125_00));
  it("J = (E + IOF) × meses × quantidade", () => close(row.totalCostCents, (125_00 + 437.5) * 12 * 6));
  it("K = quantidade × E × meses (custo cartão, sem IOF)", () => close(row.cardCostCents, 6 * 125_00 * 12));
  it("M = unitário × meses", () => close(row.unitPriceAnnualCents, 136_00 * 12));
  it("N = M × quantidade", () => close(row.clientAnnualCents, 136_00 * 12 * 6));
  it("O = N × 12% (imposto)", () => close(row.taxCents, row.clientAnnualCents * 0.12));
  it("P = N − O", () => close(row.netCents, row.clientAnnualCents - row.taxCents));
  it("Q = P − J (resultado, pode ser negativo)", () => close(row.resultCents, row.netCents - row.totalCostCents));
  it("R = Q ÷ N (margem)", () => close(row.margin!, row.resultCents / row.clientAnnualCents));

  it("quantidade zero → tudo zerado e margem nula", () => {
    const zero = computeAnnualLicenseRow({ name: "ChatGPT Business", usdCostCents: 20_00, fxRateCents: 5_00, quantity: 0, months: 12, unitPriceCents: 168_00 });
    assert.equal(zero.unitPriceAnnualCents, 0);
    assert.equal(zero.clientAnnualCents, 0);
    assert.equal(zero.netCents, 0);
    assert.equal(zero.resultCents, 0);
    assert.equal(zero.margin, null);
  });

  it("ajuste manual do custo da licença (G) substitui a fórmula e flui pro custo total (J)", () => {
    const r = computeAnnualLicenseRow({ name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 6, months: 12, unitPriceCents: 136_00, licenseCostOverrideCents: 150_00 });
    close(r.licenseCostCents, 150_00);
    close(r.totalCostCents, 150_00 * 12 * 6);
  });

  it("ajuste manual do total cliente substitui unitário × meses × quantidade e recalcula líquido/resultado", () => {
    const r = computeAnnualLicenseRow({ name: "Claude Team Standard", usdCostCents: 25_00, fxRateCents: 5_00, quantity: 6, months: 12, unitPriceCents: 136_00, clientTotalOverrideCents: 9_000_00 });
    close(r.clientAnnualCents, 9_000_00);
    close(r.netCents, 9_000_00 - 9_000_00 * 0.12);
    close(r.resultCents, r.netCents - r.totalCostCents);
    close(r.margin!, r.resultCents / 9_000_00);
  });

  it("totais somam as linhas e recalculam a margem geral", () => {
    const b = computeAnnualLicenseRow({ name: "ChatGPT Business", usdCostCents: 20_00, fxRateCents: 5_00, quantity: 3, months: 12, unitPriceCents: 168_00 });
    const totals = sumAnnualLicenseRows([row, b]);
    close(totals.clientAnnualCents, row.clientAnnualCents + b.clientAnnualCents);
    close(totals.resultCents, row.resultCents + b.resultCents);
    close(totals.margin!, totals.resultCents / totals.clientAnnualCents);
  });
});
