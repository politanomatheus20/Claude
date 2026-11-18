import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  clientResult,
  contractRevenue,
  goalContribution,
  goalProgress,
  monthlySupport,
  monthlyTraining,
  type ProposalValues,
} from "./calc";

const mensal: ProposalValues = {
  paymentType: "mensal",
  licensesCents: 1_000_00,
  supportCents: 500_00,
  trainingCents: 0,
};

const anual: ProposalValues = {
  paymentType: "anual",
  licensesCents: 12_000_00,
  supportCents: 6_000_00,
  trainingCents: 2_400_00,
};

describe("meta mensal", () => {
  it("mensal: usa o suporte direto", () => {
    assert.equal(monthlySupport(mensal), 500_00);
    assert.equal(goalContribution(mensal), 500_00);
  });

  it("anual: suporte ÷ 12", () => {
    assert.equal(monthlySupport(anual), 500_00);
  });

  it("treinamento de liderança: ÷ 12", () => {
    assert.equal(monthlyTraining(anual), 200_00);
    assert.equal(goalContribution(anual), 700_00);
  });

  it("licenças não entram na meta", () => {
    assert.equal(goalContribution({ ...mensal, licensesCents: 999_999_00 }), 500_00);
  });

  it("arredonda para o centavo", () => {
    assert.equal(monthlySupport({ ...anual, supportCents: 100_00 }), 833);
  });
});

describe("receita e resultado", () => {
  it("mensal: (licenças + suporte) × 12 + treinamento", () => {
    assert.equal(contractRevenue({ ...mensal, trainingCents: 1_000_00 }), 19_000_00);
  });

  it("anual: soma direta", () => {
    assert.equal(contractRevenue(anual), 20_400_00);
  });

  it("resultado = receita − invoices", () => {
    const r = clientResult(anual, [{ amountCents: 10_000_00 }, { amountCents: 400_00 }]);
    assert.equal(r.costCents, 10_400_00);
    assert.equal(r.resultCents, 10_000_00);
    assert.ok(Math.abs((r.margin ?? 0) - 10_000 / 20_400) < 1e-9);
  });

  it("margem nula sem receita", () => {
    const zero: ProposalValues = { paymentType: "mensal", licensesCents: 0, supportCents: 0, trainingCents: 0 };
    assert.equal(clientResult(zero, []).margin, null);
  });
});

describe("barra de progresso", () => {
  it("calcula quanto falta para a metade e para a meta", () => {
    const p = goalProgress(10_000_00, [2_000_00, 1_000_00]);
    assert.equal(p.achievedCents, 3_000_00);
    assert.equal(p.remainingToHalfCents, 2_000_00);
    assert.equal(p.remainingCents, 7_000_00);
    assert.equal(p.ratio, 0.3);
    assert.equal(p.halfReached, false);
  });

  it("limita a barra em 100% e informa o excedente", () => {
    const p = goalProgress(1_000_00, [1_500_00]);
    assert.equal(p.ratio, 1);
    assert.equal(p.reached, true);
    assert.equal(p.remainingCents, 0);
    assert.equal(p.exceededCents, 500_00);
  });

  it("meta zero não divide por zero", () => {
    const p = goalProgress(0, [100]);
    assert.equal(p.ratio, 0);
    assert.equal(p.reached, false);
  });
});
