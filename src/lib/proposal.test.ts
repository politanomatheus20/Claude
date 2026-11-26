import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  brl,
  buildInvestment,
  buildProposal,
  DATA_OMNIS_QUANTITY,
  clientSlug,
  defaultProposalNumber,
  longDate,
  PROPOSAL_SIGNERS,
  proposalFileName,
  proposalProblems,
  validUntil,
  type ProposalInput,
} from "./proposal";

const base: ProposalInput = {
  clientName: "ETPS",
  contactName: "Luana Cristina",
  number: "",
  revision: "Rev1.1",
  issuedAt: "2026-11-17",
  billing: "mensal",
  licenses: [
    { name: "Claude Team Standard", quantity: 9, unitPriceCents: 171_00 },
    { name: "Claude Team Premium", quantity: 1, unitPriceCents: 849_00 },
    { name: "ChatGPT Business", quantity: 0, unitPriceCents: 168_00 },
  ],
  supportMonthlyCents: 990_00,
  implantation: { included: true, cents: 28_000_00 },
  training: { included: true, cents: 6_500_00 },
  signers: PROPOSAL_SIGNERS.slice(0, 2),
};

describe("proposta — dados do cabeçalho", () => {
  it("nº da proposta = CLIENTE + AAAAMMDD (igual ao modelo)", () => {
    assert.equal(defaultProposalNumber("ETPS", "2026-11-17"), "ETPS20261117");
    assert.equal(clientSlug("Copersucar S/A — São Paulo"), "COPERSUCARSASAOPAULO");
  });
  it("datas por extenso e validade de 30 dias", () => {
    assert.equal(longDate("2026-11-17"), "São Paulo, 17 de novembro de 2026");
    assert.equal(validUntil("2026-11-17"), "2026-12-17");
    assert.equal(validUntil("2026-12-15"), "2027-01-14");
  });
  it("nº digitado prevalece sobre o automático", () => {
    assert.equal(buildProposal({ ...base, number: " 20261013-05 " }).number, "20261013-05");
    assert.equal(buildProposal(base).number, "ETPS20261117");
  });
  it("nome do arquivo no padrão usado hoje", () => {
    assert.equal(proposalFileName({ number: "ETPS20261117", revision: "Rev1.1", clientName: "ETPS" }), "Proposta Comercial - ETPS20261117 - Rev1.1 - ETPS.pdf");
    assert.equal(proposalFileName({ number: "X", revision: "Rev1", clientName: "A/B: C" }), "Proposta Comercial - X - Rev1 - A B C.pdf");
  });
});

describe("proposta — investimento consolidado (mensal)", () => {
  const inv = buildInvestment(base);

  it("igual ao exemplo do modelo: 9 Standard + 1 Premium + suporte = R$ 3.378,00", () => {
    assert.equal(inv.recurringTotalCents, 3_378_00);
    assert.deepEqual(
      inv.recurring.map((r) => [r.item, r.object, r.quantity, r.unit, r.unitCents, r.totalCents]),
      [
        [1, "Licenciamento Claude Team Standard", "9", "Licença", 171_00, 1_539_00],
        [2, "Licenciamento Claude Team Premium", "1", "Licença", 849_00, 849_00],
        [3, "Suporte Contínuo Consultivo 24/7", "1", "Mensal", 990_00, 990_00],
        [4, "Governança de IA – Data Omnis", "X", "Licença", null, null],
        [5, "Implantação do Sistema Claude (Kickoff)", "1", "Serviço", null, null],
      ],
    );
  });
  it("licenças com quantidade zero não entram", () => assert.ok(!inv.recurring.some((r) => r.object.includes("ChatGPT"))));
  it("opcionais continuam a numeração e somam R$ 34.500,00", () => {
    assert.deepEqual(inv.optional.map((r) => r.item), [6, 7]);
    assert.equal(inv.optionalTotalCents, 34_500_00);
  });
  it("opcional desmarcado sai da tabela", () => {
    const i = buildInvestment({ ...base, implantation: { included: false, cents: 28_000_00 } });
    assert.deepEqual(i.optional.map((r) => [r.item, r.object]), [[6, "Treinamento Claude"]]);
    assert.equal(i.optionalTotalCents, 6_500_00);
  });
  it("sem suporte (menos de 5 licenças) a linha de suporte não aparece", () => {
    const i = buildInvestment({ ...base, supportMonthlyCents: 0 });
    assert.ok(!i.recurring.some((r) => r.object.startsWith("Suporte")));
    assert.equal(i.recurringTotalCents, 2_388_00);
  });
});

describe("proposta — investimento consolidado (anual)", () => {
  it("licença anual = unitário mensal × 12 × quantidade; suporte × 12", () => {
    const inv = buildInvestment({
      ...base,
      billing: "anual",
      licenses: [{ name: "Claude Team Standard", quantity: 20, unitPriceCents: 136_00 }],
      supportMonthlyCents: 990_00,
    });
    const [lic, sup] = inv.recurring;
    assert.equal(lic.object, "Licenciamento anual – Claude Team Standard (R$ 136,00/usuário/mês)");
    assert.equal(lic.unitCents, 1_632_00);
    assert.equal(lic.totalCents, 32_640_00);
    assert.deepEqual([sup.quantity, sup.unit, sup.unitCents, sup.totalCents], ["12", "Mensalidade", 990_00, 11_880_00]);
    assert.equal(inv.recurringTotalCents, 32_640_00 + 11_880_00);
    assert.equal(inv.recurringTotalLabel, "Total estimado (12 meses):");
  });
});

describe("proposta — Data Omnis sempre com qtd. X", () => {
  const omnis = (inv: ReturnType<typeof buildInvestment>) => inv.recurring.find((r) => r.object === "Governança de IA – Data Omnis")!;
  const lic = (quantity: number) => [{ name: "Claude Team Standard", quantity, unitPriceCents: 171_00 }];

  for (const q of [1, 4, 5, 10, 20, 51, 150]) {
    for (const billing of ["mensal", "anual"] as const) {
      it(`${q} licença(s), ${billing}: qtd. "X", cortesia e fora do total`, () => {
        const withOmnis = buildInvestment({ ...base, billing, licenses: lic(q) });
        const r = omnis(withOmnis);
        assert.equal(DATA_OMNIS_QUANTITY, "X");
        assert.equal(r.quantity, "X");
        assert.equal(r.unit, "Licença");
        assert.equal(r.unitCents, null);
        assert.equal(r.totalCents, null);
        // O total não muda por causa do Omnis (é cortesia).
        const months = billing === "anual" ? 12 : 1;
        assert.equal(withOmnis.recurringTotalCents, 171_00 * months * q + base.supportMonthlyCents * months);
      });
    }
  }

  it("várias licenças diferentes: continua X (não soma as quantidades)", () => {
    assert.equal(omnis(buildInvestment(base)).quantity, "X");
  });

  it("numeração dos itens continua em sequência (com e sem suporte)", () => {
    const comSuporte = buildInvestment(base).recurring.map((r) => [r.item, r.quantity]);
    assert.deepEqual(comSuporte, [[1, "9"], [2, "1"], [3, "1"], [4, "X"], [5, "1"]]);
    const semSuporte = buildInvestment({ ...base, supportMonthlyCents: 0 }).recurring.map((r) => [r.item, r.quantity]);
    assert.deepEqual(semSuporte, [[1, "9"], [2, "1"], [3, "X"], [4, "1"]]);
  });

  it("totalQuantity (usado no texto do suporte) continua sendo o nº real de licenças", () => {
    assert.equal(buildInvestment(base).totalQuantity, 10);
  });

  it("dados do PDF trazem X na linha do Omnis", () => {
    assert.equal(omnis(buildProposal(base).investment).quantity, "X");
  });
});

describe("proposta — validação", () => {
  it("aponta o que falta", () => {
    assert.deepEqual(proposalProblems(base), []);
    const p = proposalProblems({ ...base, clientName: " ", licenses: [], signers: [], issuedAt: "" });
    assert.equal(p.length, 4);
  });
  it("moeda sem espaço especial (fonte do PDF)", () => assert.equal(brl(1_234_56), "R$ 1.234,56"));
});

describe("proposta — correções da revisão", () => {
  it("letras especiais entram no nº da proposta", () => {
    assert.equal(clientSlug("Ølsen & Søn"), "OLSENSON");
    assert.equal(clientSlug("Straße"), "STRASSE");
  });

  it("nº automático usa a data de emissão", () => {
    assert.equal(defaultProposalNumber("ETPS", "2026-11-30"), "ETPS20261130");
  });

  it("nome do arquivo fica curto mesmo com cliente enorme", () => {
    const nome = "CONSELHO NACIONAL ".repeat(12);
    const f = proposalFileName({ number: defaultProposalNumber(nome, "2026-11-23"), revision: "Rev1.0", clientName: nome });
    assert.ok(f.length < 140, `${f.length} caracteres`);
    assert.ok(f.endsWith(".pdf"));
  });

  it("valida opcional incluído sem valor e licença sem preço", () => {
    assert.ok(proposalProblems({ ...base, implantation: { included: true, cents: 0 } }).some((p) => p.includes("implantação")));
    assert.ok(proposalProblems({ ...base, training: { included: true, cents: 0 } }).some((p) => p.includes("treinamento")));
    assert.ok(proposalProblems({ ...base, training: { included: false, cents: 0 } }).every((p) => !p.includes("treinamento")));
    const semPreco = { ...base, licenses: [{ name: "Claude Team Standard", quantity: 5, unitPriceCents: 0 }] };
    assert.ok(proposalProblems(semPreco).some((p) => p.includes("valor unitário")));
    assert.deepEqual(proposalProblems(base), []);
  });
});
