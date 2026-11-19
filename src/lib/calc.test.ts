import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ANNUAL_LICENSE_REFERENCE,
  computeContract,
  computeLicenseRow,
  DEFAULT_FX_RATE_CENTS,
  goalContribution,
  goalMonthOf,
  goalProgress,
  licenseProposalSummary,
  MONTHLY_LICENSE_REFERENCE,
  sumLicenseRows,
  supportFeeFor,
  type ContractValues,
  type LicenseCalcRowInput,
  type LicenseReference,
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

/** Linha com os valores padrão da planilha (C, D, E fixos) + quantidade e valor unitário. */
const sheetRow = (ref: LicenseReference, quantity: number, extra: Partial<LicenseCalcRowInput> = {}): LicenseCalcRowInput => ({
  name: ref.name,
  usdCostCents: ref.usdCostCents,
  fxRateCents: DEFAULT_FX_RATE_CENTS,
  unitCostOverrideCents: ref.unitCostCents,
  quantity,
  unitPriceCents: ref.zeroMarginCents,
  ...extra,
});

describe("calculadora de licenças — mensal (= aba Mensal da planilha)", () => {
  // Planilha: Standard 4 × R$ 171, Premium 1 × R$ 849, ChatGPT 0.
  const [stdRef, premRef, gptRef] = MONTHLY_LICENSE_REFERENCE;
  const std = computeLicenseRow(sheetRow(stdRef, 4), 1);
  const prem = computeLicenseRow(sheetRow(premRef, 1), 1);
  const gpt = computeLicenseRow(sheetRow(gptRef, 0), 1);
  const totals = sumLicenseRows([std, prem, gpt], [4, 1, 0]);

  it("E fixo da planilha (138) · F = E × 3,5% · G = E + F", () => {
    close(std.unitCostCents, 138_00);
    close(std.iofCents, 4_83);
    close(std.licenseCostCents, 142_83);
  });
  it("I = G × H", () => close(std.totalCostCents, 571_32));
  it("K = J × 12% · L = J − K", () => {
    close(std.taxUnitCents, 20_52);
    close(std.netUnitCents, 150_48);
  });
  it("M = H × J (valor total cliente mensal)", () => close(std.clientTotalCents, 684_00));
  it("N = H × L (valor líquido)", () => close(std.netTotalCents, 601_92));
  it("O = N − I (resultado)", () => close(std.resultCents, 30_60));
  it("P = O ÷ M (margem)", () => close(std.margin!, 0.044736842105263));

  it("Premium igual à planilha", () => {
    close(prem.licenseCostCents, 712_08);
    close(prem.clientTotalCents, 849_00);
    close(prem.netTotalCents, 747_12);
    close(prem.resultCents, 35_04);
  });

  it("ChatGPT: E = C × D quando não há valor fixo", () => {
    close(gpt.unitCostCents, 100_00);
    close(gpt.licenseCostCents, 103_50);
  });

  it("quantidade zero → tudo zerado e margem vazia", () => {
    assert.equal(gpt.totalCostCents, 0);
    assert.equal(gpt.clientTotalCents, 0);
    assert.equal(gpt.netTotalCents, 0);
    assert.equal(gpt.resultCents, 0);
    assert.equal(gpt.margin, null);
  });

  it("totais = linha 9 da planilha (margem só das licenças)", () => {
    assert.equal(totals.quantity, 5);
    close(totals.totalCostCents, 1_283_40);
    close(totals.clientTotalCents, 1_533_00);
    close(totals.netTotalCents, 1_349_04);
    close(totals.resultCents, 65_64);
    close(totals.margin!, 0.042818003913894);
  });

  it("anual (12 meses) = mensal × 12 (colunas Q e R)", () => {
    const a = computeLicenseRow(sheetRow(stdRef, 4), 12);
    close(a.clientTotalCents, 8_208_00);
    close(a.resultCents, 367_20);
    close(a.margin!, std.margin!);
  });

  it("indicadores: valor cliente + suporte (pela quantidade) = total", () => {
    const s = licenseProposalSummary(totals.clientTotalCents, totals.quantity, 1);
    close(s.clientTotalCents, 1_533_00);
    assert.equal(s.supportCents, 490_00);
    close(s.grandTotalCents, 2_023_00);
  });
});

describe("calculadora de licenças — valores fixos editáveis", () => {
  const ref = MONTHLY_LICENSE_REFERENCE[0];

  it("sem valor fixo em E, câmbio novo recalcula E, IOF e custo", () => {
    const r = computeLicenseRow(sheetRow(ref, 2, { unitCostOverrideCents: null, fxRateCents: 5_40 }), 1);
    close(r.unitCostCents, 135_00);
    close(r.iofCents, 135_00 * 0.035);
    close(r.licenseCostCents, 135_00 * 1.035);
    close(r.totalCostCents, 135_00 * 1.035 * 2);
  });

  it("câmbio com 4 casas sem arredondar", () => {
    const r = computeLicenseRow(sheetRow(ref, 1, { unitCostOverrideCents: null, fxRateCents: 543.21 }), 1);
    close(r.unitCostCents, 25 * 543.21);
  });

  it("IOF digitado prevalece e entra no custo da licença", () => {
    const r = computeLicenseRow(sheetRow(ref, 4, { iofOverrideCents: 5_00 }), 1);
    close(r.iofCents, 5_00);
    close(r.licenseCostCents, 143_00);
    close(r.totalCostCents, 572_00);
    close(r.resultCents, 601_92 - 572_00);
  });

  it("custo licença digitado prevalece sobre E + F", () => {
    const r = computeLicenseRow(sheetRow(ref, 4, { licenseCostOverrideCents: 150_00 }), 1);
    close(r.licenseCostCents, 150_00);
    close(r.totalCostCents, 600_00);
    close(r.resultCents, 1_92);
  });

  it("valor unitário zero com quantidade → margem vazia (sem divisão por zero)", () => {
    const r = computeLicenseRow(sheetRow(ref, 3, { unitPriceCents: 0 }), 1);
    assert.equal(r.clientTotalCents, 0);
    assert.equal(r.margin, null);
    close(r.resultCents, -142_83 * 3);
  });
});

describe("calculadora de licenças — anual (= aba Anual da planilha)", () => {
  // Planilha: Standard 6 × R$ 136/mês, 12 meses.
  const [stdRef, premRef, gptRef] = ANNUAL_LICENSE_REFERENCE;
  const std = computeLicenseRow(sheetRow(stdRef, 6), 12);

  it("E fixo (110) · F · G", () => {
    close(std.unitCostCents, 110_00);
    close(std.iofCents, 3_85);
    close(std.licenseCostCents, 113_85);
  });
  it("J = G × 12 × qtd (custo anual)", () => close(std.totalCostCents, 8_197_20));
  it("N = J × 12 × qtd (valor cliente anual)", () => close(std.clientTotalCents, 9_792_00));
  it("O = N × 12% · P = N − O (líquido)", () => {
    close(std.taxCents, 1_175_04);
    close(std.netTotalCents, 8_616_96);
  });
  it("Q = P − J (resultado)", () => close(std.resultCents, 419_76));
  it("R = Q ÷ N (margem)", () => close(std.margin!, 0.042867647058824));

  it("totais e indicadores anuais (suporte × 12)", () => {
    const prem = computeLicenseRow(sheetRow(premRef, 0), 12);
    const gpt = computeLicenseRow(sheetRow(gptRef, 0), 12);
    const totals = sumLicenseRows([std, prem, gpt], [6, 0, 0]);
    close(totals.clientTotalCents, 9_792_00);
    close(totals.resultCents, 419_76);
    const s = licenseProposalSummary(totals.clientTotalCents, totals.quantity, 12);
    assert.equal(s.supportCents, 490_00 * 12);
    close(s.grandTotalCents, 9_792_00 + 5_880_00);
  });
});

describe("suporte por faixa de quantidade", () => {
  it("taxa fixa por faixa de quantidade total de licenças", () => {
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
});

describe("leitura de números digitados", () => {
  it("formatos brasileiro e americano", async () => {
    const { parseDecimal, parseMoneyToCents } = await import("./format");
    assert.equal(parseMoneyToCents("R$ 1.234,56"), 123456);
    assert.equal(parseMoneyToCents("1234,56"), 123456);
    assert.equal(parseMoneyToCents("1234.56"), 123456);
    assert.equal(parseMoneyToCents("1,234.56"), 123456);
    assert.equal(parseMoneyToCents("1.000"), 100000);
    assert.equal(parseMoneyToCents("1.000.000"), 100000000);
    assert.equal(parseDecimal("5,4321"), 5.4321);
    assert.equal(parseDecimal("5.4321"), 5.4321);
    assert.equal(parseMoneyToCents("abc"), null);
    assert.equal(parseMoneyToCents("1.2.3,4,5"), null);
  });
});

describe("datas no horário de Brasília", () => {
  it("today() e currentMonth() no formato certo", async () => {
    const { today, currentMonth, isValidMonth } = await import("./format");
    assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(currentMonth(), today().slice(0, 7));
    assert.equal(isValidMonth("2026-13"), false);
    assert.equal(isValidMonth("2026-12"), true);
  });
});
