/**
 * Proposta comercial em PDF — recriação do "Modelo Mestre.docx" com
 * @react-pdf/renderer. Roda no navegador (carregado sob demanda pelo botão
 * "Baixar PDF"), então funciona igual em produção (Vercel), sem Word.
 *
 * Textos fixos = texto do modelo. Dados variáveis vêm de src/lib/proposal.ts.
 */

import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  brl,
  brlPlain,
  type InvestmentRow,
  type ProposalData,
} from "@/lib/proposal";

// ——— Identidade visual do modelo ———
const BLUE = "#4E84FB";
const TABLE_HEAD = "#6699FF";
const TEXT = "#717377";
const DARK = "#404040";
const ZEBRA = "#F1F1F1";
const LINE = "#DCDDE0";
const FONT = "Poppins";
const A4_WIDTH = 595.28;
const WAVE_RATIO = 228 / 1645;

let assetBase = "";
const asset = (path: string) => `${assetBase}/proposta/${path}`;

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: FONT,
    fonts: [
      { src: asset("fonts/poppins-400.woff"), fontWeight: 400 },
      {
        src: asset("fonts/poppins-400-italic.woff"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      { src: asset("fonts/poppins-500.woff"), fontWeight: 500 },
      { src: asset("fonts/poppins-600.woff"), fontWeight: 600 },
      { src: asset("fonts/poppins-700.woff"), fontWeight: 700 },
    ],
  });
  // Sem hifenização automática (o padrão é em inglês e quebra palavras em português).
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    color: TEXT,
    paddingTop: 92,
    paddingBottom: 56,
    paddingHorizontal: 54,
    lineHeight: 1.5,
  },
  bluePage: {
    fontFamily: FONT,
    backgroundColor: BLUE,
    color: "#FFFFFF",
    padding: 0,
  },
  header: {
    position: "absolute",
    top: 30,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLogo: { width: 118, height: 118 * (68 / 405) },
  headerSite: { fontSize: 8.5, color: BLUE },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 54,
    fontSize: 7.5,
    color: "#A7A9AC",
  },
  h1: {
    fontSize: 16,
    fontWeight: 600,
    color: BLUE,
    marginBottom: 12,
    marginTop: 4,
  },
  h2: {
    fontSize: 11,
    fontWeight: 600,
    color: BLUE,
    marginTop: 10,
    marginBottom: 6,
  },
  h3: {
    fontSize: 9.5,
    fontWeight: 600,
    color: BLUE,
    marginTop: 8,
    marginBottom: 3,
  },
  p: { textAlign: "justify", marginBottom: 7 },
  b: { fontWeight: 600, color: DARK },
  bulletRow: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
  bulletDot: { width: 10, color: BLUE },
  bulletText: { flex: 1, textAlign: "justify" },
  table: {
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: LINE,
  },
  th: { flexDirection: "row", backgroundColor: TABLE_HEAD },
  thCell: {
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  tr: { flexDirection: "row", borderTopWidth: 0.5, borderColor: LINE },
  td: {
    fontSize: 8,
    color: DARK,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    lineHeight: 1.4,
  },
  totalRow: { flexDirection: "row", backgroundColor: TABLE_HEAD },
  totalCell: {
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  wave: {
    position: "absolute",
    left: 0,
    width: A4_WIDTH,
    height: A4_WIDTH * WAVE_RATIO,
  },
});

// ——— Blocos básicos ———
function Header() {
  return (
    <View style={s.header} fixed>
      <PdfImage src={asset("img/logo.png")} style={s.headerLogo} />
      <Text style={s.headerSite}>datagroup.global</Text>
    </View>
  );
}

function PageNumber() {
  return (
    <Text
      style={s.pageNumber}
      fixed
      render={({ pageNumber }) => String(pageNumber)}
    />
  );
}

function ContentPage({
  children,
  bottomWave = false,
}: {
  children: React.ReactNode;
  bottomWave?: boolean;
}) {
  return (
    <Page
      size="A4"
      style={bottomWave ? [s.page, { paddingBottom: 96 }] : s.page}
    >
      <Header />
      {bottomWave ? (
        // Só na primeira página da seção (como no modelo).
        <View
          fixed
          style={[s.wave, { bottom: 0 }]}
          render={({ subPageNumber }) =>
            subPageNumber === 1 ? (
              <PdfImage
                src={asset("img/onda-clara.png")}
                style={{ width: "100%", height: "100%" }}
              />
            ) : null
          }
        />
      ) : null}
      {children}
      <PageNumber />
    </Page>
  );
}

const H1 = ({ n, children }: { n?: string; children: React.ReactNode }) => (
  <Text style={s.h1} minPresenceAhead={80}>
    {n ? `${n}.  ` : ""}
    {children}
  </Text>
);
const H2 = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.h2} minPresenceAhead={60}>
    {children}
  </Text>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.h3} minPresenceAhead={40}>
    {children}
  </Text>
);
const P = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: typeof s.p;
}) => <Text style={[s.p, style ?? {}]}>{children}</Text>;
const B = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.b}>{children}</Text>
);

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <View style={{ marginBottom: 6 }}>
      {items.map((item, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface Col {
  label: string;
  width: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

function Table({ cols, rows }: { cols: Col[]; rows: React.ReactNode[][] }) {
  return (
    <View style={s.table}>
      <View style={s.th} fixed={false}>
        {cols.map((c) => (
          <Text key={c.label} style={[s.thCell, { width: c.width }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[s.tr, { backgroundColor: i % 2 === 1 ? ZEBRA : "#FFFFFF" }]}
          wrap={false}
        >
          {r.map((cell, j) => (
            <Text
              key={j}
              style={[
                s.td,
                { width: cols[j].width, textAlign: cols[j].align ?? "left" },
                cols[j].bold ? { fontWeight: 600 } : {},
              ]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ——— Páginas ———
function Cover({ d }: { d: ProposalData }) {
  const info: [string, string][] = [
    ["Contato:", d.contactName || "—"],
    ["N/Proposta:", d.number],
    ["Revisão:", d.revision || "—"],
    ["Emitida em:", d.issuedLabel],
  ];
  return (
    <Page size="A4" style={s.bluePage}>
      <View style={{ position: "absolute", top: 150, left: 54, right: 54 }}>
        <Text style={{ fontSize: 26, fontWeight: 700 }}>
          Proposta Comercial
        </Text>
        <Text style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2 }}>
          IMPLEMENTAÇÃO DE INTELIGÊNCIA ARTIFICIAL COM ANTHROPIC (CLAUDE)
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          top: 300,
          right: 54,
          left: 200,
          alignItems: "flex-end",
        }}
      >
        <Text style={{ fontSize: 16 }}>Preparada para:</Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginTop: 16,
            textAlign: "right",
          }}
        >
          {d.clientName}
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          top: 395,
          left: 54,
          borderLeftWidth: 3,
          borderColor: "#FFFFFF",
          paddingLeft: 12,
          paddingVertical: 2,
        }}
      >
        {info.map(([label, value]) => (
          <View key={label} style={{ marginBottom: 9 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 600 }}>{label}</Text>
            <Text style={{ fontSize: 8.5, fontWeight: 600 }}>—</Text>
            <Text style={{ fontSize: 8.5, fontWeight: 600 }}>{value}</Text>
          </View>
        ))}
      </View>
      <PdfImage src={asset("img/onda.png")} style={[s.wave, { bottom: 0 }]} />
    </Page>
  );
}

function Letter({ d }: { d: ProposalData }) {
  return (
    <ContentPage>
      <View style={{ marginTop: 50, width: "62%" }}>
        <Text style={{ fontSize: 13, fontWeight: 600, color: BLUE }}>
          Proposta Comercial para
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: BLUE,
            marginBottom: 18,
          }}
        >
          {d.clientName}
        </Text>
        <P>Prezados Senhores,</P>
        <P>
          Agradecemos a oportunidade de apresentar nossa proposta para a
          implementação do Claude, a inteligência artificial da Anthropic, na
          empresa contratante. Como parceiro oficial da Anthropic no Brasil, o
          Data Group cuida do licenciamento, da implantação com governança, da
          capacitação das lideranças e do suporte contínuo em português, para
          que a IA gere resultado com segurança desde as primeiras semanas.
        </P>
        <P>
          Esperamos ter apresentado todas as informações necessárias para a
          avaliação e aprovação desta proposta.
        </P>
        <P>Estamos à disposição para maiores esclarecimentos.</P>
        <P>Cordialmente,</P>
        <Text style={{ fontWeight: 600, color: BLUE, marginTop: 6 }}>
          Equipe Data Group
        </Text>
      </View>
    </ContentPage>
  );
}

function About() {
  return (
    <Page size="A4" style={s.bluePage}>
      <PdfImage src={asset("img/onda-topo.png")} style={[s.wave, { top: 0 }]} />
      <View style={{ position: "absolute", top: 120, left: 54, right: 54 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          Sobre o Data Group
        </Text>
        <Text
          style={{
            fontSize: 8.5,
            lineHeight: 1.55,
            textAlign: "justify",
            marginBottom: 8,
          }}
        >
          O Data Group é um grupo internacional de tecnologia, com origem no
          Brasil, 15 anos de mercado e operação em 5 países. Somos parceiro
          oficial da Anthropic, credenciado na Claude Partner Network, e
          apoiamos nossos clientes em todo o processo de adoção da IA, do
          licenciamento à implantação, com foco em produtividade, governança e
          gestão.
        </Text>
        <Text
          style={{
            fontSize: 8.5,
            lineHeight: 1.55,
            textAlign: "justify",
            marginBottom: 8,
          }}
        >
          Nossos serviços em IA incluem: licenciamento oficial Claude (Team,
          Enterprise e API), com faturamento em Real e NF-e; consultoria para
          mapear processos e oportunidades de automação; implantação e
          integração com os sistemas existentes; desenvolvimento de agentes e
          automações inteligentes; treinamentos corporativos com instrutor
          certificado; e suporte contínuo em português, com SLA garantido.
        </Text>
        <Text style={{ fontSize: 8.5, lineHeight: 1.55, textAlign: "justify" }}>
          Com base nas conversas com a contratante, elaboramos esta proposta
          para levar o Claude Enterprise à companhia com governança, segurança
          da informação e faturamento local.
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          top: 420,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <PdfImage
          src={asset("img/logo-branco.png")}
          style={{ width: 230, height: 230 * (262 / 893) }}
        />
        <Text style={{ fontSize: 10, marginTop: 40 }}>
          Inteligência artificial, outsourcing de TI, Service Desk e
          cibersegurança.
        </Text>
        <Text
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            fontStyle: "normal",
            marginTop: 10,
          }}
        >
          Mais de 400 empresas e órgãos públicos atendidos.
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 60,
          left: 90,
          right: 90,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <PdfImage
          src={asset("img/gptw-qr.png")}
          style={{ width: 170, height: 170 * (311 / 400) }}
        />
        <PdfImage
          src={asset("img/iso9001.png")}
          style={{ width: 80, height: 80 * (204 / 144) }}
        />
      </View>
    </Page>
  );
}

function Partnership() {
  return (
    <ContentPage>
      <H1>Parceria Data Group e Claude</H1>
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <PdfImage
          src={asset("img/claude-partner.jpg")}
          style={{ width: 230, height: 230 * (184 / 704) }}
        />
      </View>
      <P>
        <B>O Data Group é o maior parceiro Claude do Brasil</B>, credenciado na
        Claude Partner Network da Anthropic. Levamos o Claude às empresas com
        tudo o que uma adoção séria exige: licenças oficiais com faturamento em
        reais, projeto com governança, capacitação das equipes e suporte em
        português.
      </P>
      <P>
        A parceria se apoia em três frentes, que podem ser contratadas juntas ou
        separadamente:
      </P>
      <Table
        cols={[
          { label: "Frente", width: "24%", bold: true },
          { label: "O que entregamos", width: "76%" },
        ]}
        rows={[
          [
            "Licenciamento",
            "Licenças oficiais Claude Team, Enterprise e API, com faturamento em reais, nota fiscal emitida no Brasil e gestão centralizada de usuários, planos e consumo.",
          ],
          [
            "Consultoria",
            "Mapeamento de processos e oportunidades de uso, implantação com governança (SSO, políticas de uso por área, conectores) e desenvolvimento de agentes e automações com o Claude.",
          ],
          [
            "Treinamentos",
            "Capacitação de lideranças e equipes com instrutor certificado, do uso no dia a dia a prompts avançados, com boas práticas de segurança e de LGPD.",
          ],
        ]}
      />
      <P>
        Para completar, o suporte contínuo em português e o Data Omnis, a
        plataforma de governança de IA do Data Group, acompanham a empresa
        depois da implantação, do primeiro acesso ao uso do Claude em escala.
      </P>
      <H2>Por que contratar o Claude com o Data Group</H2>
      <Bullets
        items={[
          <>
            <B>Maior parceiro Claude do Brasil:</B> experiência acumulada em
            projetos de adoção do Claude em empresas de diferentes portes e
            setores.
          </>,
          <>
            <B>Contratação simples:</B> faturamento em reais, nota fiscal
            brasileira e possibilidade de contratação via processo de
            suprimentos, sem cartão internacional.
          </>,
          <>
            <B>Tudo num só parceiro:</B> licenças, implantação, treinamento e
            suporte com o mesmo time, do primeiro acesso ao uso em escala.
          </>,
          <>
            <B>Atendimento em português:</B> suporte contínuo 24/7 com SLA e
            acompanhamento próximo das áreas usuárias.
          </>,
        ]}
      />
    </ContentPage>
  );
}

const CLIENT_LOGOS = Array.from({ length: 39 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const jpg = [5, 6, 9, 13, 18, 21, 22, 24, 25, 30, 32, 33, 35, 36, 37];
  return `clientes/${n}.${jpg.includes(i + 1) ? "jpg" : "png"}`;
});

function WhyUs() {
  return (
    <ContentPage>
      <H1>Por que escolher o Data Group?</H1>
      <P>
        <B>O Data Group é o maior parceiro Claude do Brasil</B> e ajuda empresas
        a acelerar a transformação digital com consultoria tecnológica,
        outsourcing de TI, Inteligência Artificial, gestão de serviços de TI
        (ITSM) e cibersegurança. São mais de 400 empresas e órgãos públicos
        atendidos no Brasil e em Portugal, mais de 200 profissionais alocados e
        operação de NOC e SOC 24x7.
      </P>
      <Text
        style={{
          fontSize: 11,
          fontWeight: 600,
          fontStyle: "italic",
          color: BLUE,
          textAlign: "center",
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        Alguns de nossos Clientes
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {CLIENT_LOGOS.map((src) => (
          <View
            key={src}
            style={{
              width: "16.66%",
              height: 40,
              padding: 5,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PdfImage
              src={asset(src)}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ marginTop: 18, alignItems: "center" }}>
        {[
          "7 das 10 Top empresas de engenharia e construção",
          "7 das 10 Top empresas de TI e Tecnologia",
          "8 dos 10 ministérios e agências governamentais",
          "4 das 5 Top companhias aéreas",
          "13 das 15 Top Lojas de Departamento",
          "5 das 10 Top companhias de Óleo e Gás",
        ].map((t) => (
          <Text
            key={t}
            style={{
              fontSize: 9,
              fontWeight: 600,
              fontStyle: "italic",
              color: DARK,
              marginBottom: 2,
            }}
          >
            {t}
          </Text>
        ))}
      </View>
    </ContentPage>
  );
}

function Context() {
  return (
    <ContentPage>
      <H1 n="I">Contexto e Objetivos</H1>
      <P>
        A inteligência artificial generativa já faz parte do dia a dia das
        empresas. Em muitas delas, porém, a adoção começa de forma espontânea:
        colaboradores passam a usar ferramentas de IA por conta própria, muitas
        vezes em contas gratuitas ou pessoais, sem governança centralizada, sem
        visibilidade de custos e sem garantia de proteção dos dados
        corporativos. Ao mesmo tempo, as áreas de TI e de segurança da
        informação precisam manter o controle de acessos, a conformidade com a
        LGPD e a previsibilidade orçamentária.
      </P>
      <P>
        Diante desse cenário, a contratante busca um parceiro para viabilizar a
        contratação oficial do Claude (Anthropic), com faturamento local,
        suporte em português e níveis de segurança e governança compatíveis com
        o ambiente corporativo já existente.
      </P>
      <P>
        Para a adoção da IA, esta proposta considera os seguintes objetivos:
      </P>
      <Bullets
        items={[
          "Migrar eventuais usuários já cadastrados com o domínio corporativo (uso gratuito e não governado) para uma organização oficial no Claude;",
          "Centralizar a governança do licenciamento de IA, com auditoria de logs, políticas de uso por perfil/área e rateio de consumo por centro de custo, apoiada pelo Data Omnis;",
          "Integrar a solução ao provedor de identidade corporativo (SSO e políticas de acesso condicional), com escalabilidade conforme a evolução das demandas;",
          "Substituir pagamentos avulsos em cartão corporativo por um modelo estruturado via suprimentos, com faturamento local e previsibilidade orçamentária;",
          "Capacitar lideranças e usuários finais para o uso efetivo e seguro da IA, com trilha de adoção estendida além da capacitação inicial.",
        ]}
      />
    </ContentPage>
  );
}

function Solution() {
  return (
    <ContentPage>
      <H1 n="II">Solução Proposta – Visão Geral</H1>
      <P>
        A solução proposta pelo Data Group é estruturada em quatro módulos
        complementares, mais a plataforma Data Omnis como cortesia, desenhados
        para acompanhar a maturidade digital da contratante e gerar resultados
        desde as primeiras semanas de uso. Os módulos de Implantação e de
        Treinamento para Liderança são opcionais e podem ser contratados
        conforme a necessidade.
      </P>
      <Table
        cols={[
          { label: "Nº", width: "7%", align: "center" },
          { label: "Módulo", width: "25%", bold: true },
          { label: "Descrição", width: "68%" },
        ]}
        rows={[
          [
            "1",
            "Implantação (opcional)",
            "Implantação do ambiente, incluindo a consultoria de governança e adoção (integração com SSO, verificação de domínio e definição de políticas de uso): configurações necessárias, validação dos acessos e disponibilização do ambiente para os usuários, garantindo o funcionamento correto da solução e o início da operação.",
          ],
          [
            "2",
            "Licenciamento Claude",
            "Contratação das licenças Claude Team ou Enterprise, com dois cenários de volumetria em avaliação: piloto (mínimo de 5 usuários para o Team e de 20 usuários para o Enterprise) ou adoção inicial ampliada (referência de 150 usuários), com saldo mensal de tokens dimensionado conforme o volume escolhido.",
          ],
          [
            "3",
            "Treinamento para Liderança (opcional)",
            "Capacitação das lideranças em boas práticas, produtividade, desenvolvimento de soluções e prompts avançados de gestão.",
          ],
          [
            "4",
            "Suporte Contínuo Consultivo",
            "Suporte Nível 1 e Nível 2 em português, 24/7, com SLA garantido para dúvidas e questões dos usuários.",
          ],
          [
            "5",
            "Governança de IA – Data Omnis (cortesia)",
            "Plataforma de contexto e governança para a IA: glossário e regras da empresa, limites por área, dados pessoais mascarados e trilha de auditoria de cada consulta.",
          ],
        ]}
      />
      <H1 n="III">Etapas de Implantação</H1>
      <P>
        A implantação (item opcional), que já incorpora as atividades de
        consultoria de governança e adoção, segue metodologia estruturada em
        seis etapas sequenciais, com prazo total de 21 dias úteis contados a
        partir do kick-off do projeto, conforme detalhado abaixo.
      </P>
      <Table
        cols={[
          { label: "Nº", width: "7%", align: "center" },
          { label: "Etapa", width: "23%", bold: true },
          { label: "Prazo", width: "14%", align: "center" },
          { label: "Descrição", width: "56%" },
        ]}
        rows={[
          [
            "01",
            "Kick-off e alinhamento",
            "2 dias úteis",
            "Reunião de abertura oficial com as equipes da contratante e do Data Group. Alinhamento de escopo, cronograma, responsáveis e ferramentas de comunicação.",
          ],
          [
            "02",
            "Verificação de domínio e SSO",
            "5 dias úteis",
            "Confirmação do domínio corporativo e configuração do SSO com o provedor de identidade da contratante, reaproveitando as políticas de acesso condicional já aplicadas.",
          ],
          [
            "03",
            "Migração de usuários do domínio",
            "3 dias úteis",
            "Identificação dos usuários já cadastrados com o domínio corporativo e migração/aprovação para o tenant oficial, com bloqueio de contas pessoais.",
          ],
          [
            "04",
            "Configuração do ambiente e testes",
            "4 dias úteis",
            "Configuração final do ambiente Enterprise, validação de acessos e testes com usuários-chave de cada área.",
          ],
          [
            "05",
            "Validação final e go-live",
            "2 dias úteis",
            "Homologação com sign-off da contratante e liberação do ambiente para uso em produção.",
          ],
        ]}
      />
    </ContentPage>
  );
}

function Licensing() {
  return (
    <ContentPage>
      <H1 n="IV">Licenciamento Claude (Anthropic)</H1>
      <P>
        O Claude é o assistente de inteligência artificial da Anthropic,
        reconhecido mundialmente como um dos modelos mais avançados e seguros
        disponíveis. O licenciamento garante acesso ao ambiente oficial da
        plataforma, com segurança de dados, conformidade com a LGPD e
        atualizações contínuas.
      </P>
      <H2>Comparativo: Plano Team x Plano Enterprise</H2>
      <Table
        cols={[
          { label: "Critério", width: "30%", bold: true },
          { label: "Plano Team", width: "35%", align: "center" },
          { label: "Plano Enterprise", width: "35%", align: "center" },
        ]}
        rows={[
          [
            "Limite de usuários",
            "Até 150 usuários",
            "Mínimo de 20 usuários (sem limite superior)",
          ],
          ["Modelos disponíveis", "Haiku, Sonnet, Opus", "Haiku, Sonnet, Opus"],
          [
            "Modelo de consumo",
            "Sessões diárias limitadas",
            "Saldo de tokens (pós-pago, conforme uso)",
          ],
          [
            "Governança e políticas de uso",
            "Básica (AD e gestão de licenças)",
            "Granular (políticas, conectores e guardrails)",
          ],
          [
            "Auditoria de consumo",
            "Barra de progresso (%)",
            "Console de API com auditoria de prompts",
          ],
          [
            "Acesso à plataforma",
            "Chat e desktop",
            "Chat, desktop, Code, Cowork e API",
          ],
          [
            "Custo / usuário / mês – contrato anual",
            "R$ 136,00 Standard | R$ 689,00 Premium (mín. 5 usuários)",
            "R$ 136,00 (mín. 20 usuários)",
          ],
          [
            "Custo / usuário / mês – contrato mensal",
            "R$ 171,00 Standard | R$ 849,00 Premium",
            "Somente contrato anual",
          ],
          ["Saldo mensal de tokens", "—", "R$ 3.000,00 (sugestão)"],
        ]}
      />
      <Bullets
        items={[
          <>
            <B>Custo fixo da plataforma:</B> segue o custo do licenciamento,
            cujo valor poderá variar conforme o tipo de licença escolhido; estão
            disponíveis Code, Cowork, skills, políticas de uso e guardrails. O
            licenciamento é mensal ou anual, conforme a escolha.
          </>,
          <>
            <B>Saldo de tokens:</B> em caso do Enterprise, o saldo de tokens
            mensal é dimensionado conforme o volume de uso, consumido conforme o
            uso e debitado pelo console da API. O saldo pode ser mensalizado e
            não expira, acumulando para os meses seguintes.
          </>,
          <>
            <B>Novos modelos e atualizações:</B> o Plano Team e Enterprise
            garante acesso a todos os modelos Claude disponíveis, incluindo os
            que a Anthropic venha a lançar durante a vigência do contrato, sem
            custo adicional de licença por conta do lançamento de um novo
            modelo.
          </>,
          <>
            <B>Valores em reais:</B> o licenciamento Team ou Enterprise (custo
            fixo por usuário/mês) é cobrado em reais e se mantém pelo valor da
            tabela de investimento durante a vigência anual.
          </>,
          <>
            <B>Data Omnis (cortesia):</B> Data Omnis, sem custo, para governança
            e auditoria do uso da IA.
          </>,
        ]}
      />
    </ContentPage>
  );
}

function Training({ d }: { d: ProposalData }) {
  return (
    <ContentPage>
      <H1 n="V">Treinamento para Liderança</H1>
      <P>
        O treinamento capacita gestores e diretores como usuários estratégicos
        da contratante, capazes não apenas de utilizar o Claude, mas de
        identificar oportunidades, criar suas próprias soluções e disseminar a
        cultura de IA nas suas equipes. Considerando o volume de usuários e a
        curva de aprendizado comum na adoção de ferramentas de IA, o Data Group
        recomenda complementar as 4 horas iniciais com uma trilha de adoção
        estendida (acompanhamento por cerca de 30 dias), oferecida como item
        opcional adicional.
      </P>
      <P>
        <B>Público-alvo:</B> diretores, gerentes e líderes de equipe das áreas
        de RH, Financeiro, Comercial e TI.
      </P>
      <P>
        <B>Formato:</B> online | <B>Carga horária:</B> 4 horas (podendo ser
        divididas em sessões).
      </P>
      <H2>Módulos do Programa</H2>
      <Table
        cols={[
          { label: "Módulo", width: "11%", align: "center", bold: true },
          { label: "Tema", width: "31%" },
          { label: "Conteúdo", width: "58%" },
        ]}
        rows={[
          [
            "M1",
            "IA para gestores: o que mudou e o que isso significa para você",
            "O que é o Claude e por que ele é diferente de uma busca no Google. Como a IA lê contexto e apoia decisões baseadas em dados. O papel do gestor na era da IA: menos operação, mais estratégia. Demonstração ao vivo com dados do negócio.",
          ],
          [
            "M2",
            "Transforme seus dados em respostas: como consultar o Claude como um analista",
            "Como fazer perguntas estratégicas sobre margem, inadimplência, headcount e desempenho. Técnicas para extrair insights de bases de dados sem depender de relatórios prontos. Simulações com cenários reais de RH e Financeiro.",
          ],
          [
            "M3",
            "Automatize o que toma seu tempo e o da sua equipe",
            "Mapeamento das tarefas repetitivas de cada área. Como instruir o Claude a executar rotinas: resumos, alertas, triagem de documentos e rascunhos. Construção de um fluxo de trabalho com IA integrado às ferramentas do dia a dia (ex.: Microsoft Teams).",
          ],
          [
            "M4",
            "Governança e boas práticas: usando IA com responsabilidade corporativa",
            "O que nunca delegar para a IA sem validação humana. Política de uso, privacidade de dados e LGPD no contexto da organização. Como criar uma cultura de IA saudável na equipe: adoção sem dependência cega.",
          ],
        ]}
      />
      <H2>Investimento – Treinamento</H2>
      <Table
        cols={[
          { label: "Escopo", width: "70%" },
          { label: "Valor", width: "30%", align: "center", bold: true },
        ]}
        rows={[
          ["Treinamento para Liderança (opcional)", brl(d.trainingCents)],
          ["Material de apoio e templates", "Incluído"],
        ]}
      />
    </ContentPage>
  );
}

function Support() {
  return (
    <ContentPage>
      <H1 n="VI">Suporte Contínuo Consultivo</H1>
      <P>
        O Suporte Contínuo Consultivo do Data Group garante que a contratante
        tenha sempre um parceiro especializado disponível para resolver dúvidas,
        orientar usuários e apoiar a evolução contínua do ambiente Claude.
      </P>
      <Table
        cols={[
          { label: "Característica", width: "30%", bold: true },
          { label: "Detalhe", width: "70%" },
        ]}
        rows={[
          [
            "Nível de suporte",
            "Nível 1 (dúvidas de uso) e Nível 2 (questões técnicas e de integração)",
          ],
          [
            "Disponibilidade",
            "24 horas por dia, 7 dias por semana (horas corridas)",
          ],
          ["Idioma", "Português (BR)"],
          [
            "SLA – Nível 1",
            "Resposta em até 4 horas corridas | Resolução em até 24 horas corridas",
          ],
          [
            "SLA – Nível 2",
            "Resposta em até 8 horas corridas | Resolução em até 48 horas corridas",
          ],
          [
            "Casos dependentes da plataforma Anthropic",
            "Para chamados cuja resolução dependa da própria plataforma Anthropic (ex.: incidentes de infraestrutura do provedor), o Data Group mantém o acompanhamento ativo do chamado junto à Anthropic até a resolução, informando a contratante sobre o andamento.",
          ],
          ["Canais de atendimento", "WhatsApp, e-mail e Microsoft Teams"],
        ]}
      />
    </ContentPage>
  );
}

const INVESTMENT_COLS: Col[] = [
  { label: "Item", width: "8%", align: "center" },
  { label: "Objeto", width: "38%" },
  { label: "Qtd.", width: "8%", align: "center" },
  { label: "Und.", width: "13%", align: "center" },
  { label: "Valor unitário (R$)", width: "16%", align: "right" },
  { label: "Valor total (R$)", width: "17%", align: "right" },
];

const moneyCell = (c: number | null) => (c === null ? "Cortesia" : brlPlain(c));
const investmentRows = (rows: InvestmentRow[]) =>
  rows.map((r) => [
    String(r.item),
    r.object,
    r.quantity,
    r.unit,
    moneyCell(r.unitCents),
    moneyCell(r.totalCents),
  ]);

function TotalRow({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={s.totalRow} wrap={false}>
      <Text style={[s.totalCell, { width: "83%", textAlign: "right" }]}>
        {label}
      </Text>
      <Text style={[s.totalCell, { width: "17%", textAlign: "right" }]}>
        {brl(cents)}
      </Text>
    </View>
  );
}

function Investment({ d }: { d: ProposalData }) {
  const inv = d.investment;
  const anual = d.billing === "anual";
  return (
    <ContentPage>
      <H1 n="VII">Investimento Consolidado</H1>
      <P>
        Abaixo, o resumo consolidado do investimento, com os itens recorrentes
        separados dos serviços opcionais. Os valores são estimativas e serão
        detalhados na proposta técnica e financeira formal após o alinhamento
        final de escopo.
      </P>
      <H2>
        Licenciamento e Suporte
        {anual ? " (contrato anual)" : " (valores mensais)"}
      </H2>
      <View wrap={false}>
        <Table cols={INVESTMENT_COLS} rows={investmentRows(inv.recurring)} />
        <View style={{ marginTop: -10, marginBottom: 12 }}>
          <TotalRow
            label={inv.recurringTotalLabel}
            cents={inv.recurringTotalCents}
          />
        </View>
      </View>
      {inv.optional.length > 0 ? (
        <>
          <H2>Serviços Opcionais</H2>
          <View wrap={false}>
            <Table cols={INVESTMENT_COLS} rows={investmentRows(inv.optional)} />
            <View style={{ marginTop: -10, marginBottom: 12 }}>
              <TotalRow
                label="Total dos opcionais:"
                cents={inv.optionalTotalCents}
              />
            </View>
          </View>
        </>
      ) : null}
      <P>
        <B>Resumo por forma de pagamento:</B> (i) Licenciamento Claude,{" "}
        {anual ? "em parcela única" : "em parcelas mensais"} com vencimento em
        10 dias a partir da emissão da nota fiscal; (ii) Mensalidade recorrente:
        saldo de tokens (pós-pago, quando aplicável) + Suporte Contínuo
        Consultivo 24/7, faturados mensalmente com vencimento em 10 dias a
        partir da emissão de cada nota fiscal.
      </P>
      {inv.optional.length > 0 ? (
        <P>
          <B>
            Os serviços opcionais ({optionalNames(d)}), quando contratados, são
            faturados em parcela única, com vencimento em 30 dias a partir da
            emissão da nota fiscal.
          </B>
        </P>
      ) : null}
    </ContentPage>
  );
}

function optionalNames(d: ProposalData) {
  const names = [
    d.implantationIncluded ? "Implantação" : null,
    d.trainingIncluded ? "Treinamento para Liderança" : null,
  ].filter(Boolean);
  return names.join(" e ");
}

function Omnis() {
  return (
    <ContentPage>
      <H2>Data Omnis: governança de IA</H2>
      <PdfImage
        src={asset("img/omnis.png")}
        style={{ width: 110, height: 110 * (58 / 283), marginBottom: 10 }}
      />
      <P>
        O <B>Data Omnis</B> é a plataforma própria do Data Group de contexto e
        governança para a IA da empresa. Ele ensina à IA as definições da
        companhia e aplica as regras de acesso no momento de cada consulta: a
        resposta cita a fonte, e cada consulta gera um registro de quem leu o
        quê. É a camada que permite levar o Claude às áreas de negócio com
        controle e prova do que foi feito.
      </P>
      <Table
        cols={[
          { label: "Pilar", width: "22%", bold: true },
          { label: "O que entrega", width: "78%" },
        ]}
        rows={[
          [
            "Contexto",
            "A IA usa o vocabulário da empresa (glossário, métricas e regras de negócio) e cita a fonte de cada número que apresenta.",
          ],
          [
            "Governança",
            "Limites por área aplicados na própria estrutura, dados pessoais mascarados, negativas registradas e papéis com alçada.",
          ],
          [
            "Ação",
            "O agente propõe ações nos sistemas da empresa (ex.: chamados e tarefas) e só executa depois da aprovação de quem tem alçada.",
          ],
          [
            "Auditoria",
            "Cada consulta gera um registro (quem leu, o quê e com qual finalidade), inclusive as negadas, em trilha pronta para o DPO.",
          ],
        ]}
      />
      <P>
        <B>Canais e integrações:</B> perguntas pela web, pelo Microsoft Teams
        (com a conta corporativa) ou pelo WhatsApp (número pareado com código de
        uso único). Funciona com os principais modelos de IA, entre eles o
        Claude, e se conecta a ERP, bancos de dados, planilhas, documentos,
        aplicativos de negócio e BI.
      </P>
      <View style={{ alignItems: "center", marginTop: 4 }} wrap={false}>
        <PdfImage
          src={asset("img/omnis-tela.jpg")}
          style={{
            width: 380,
            height: 380 * (888 / 1400),
            borderWidth: 0.5,
            borderColor: LINE,
          }}
        />
        <Text style={{ fontSize: 7.5, marginTop: 4, textAlign: "center" }}>
          Tela do Data Omnis: resposta com a regra de cálculo explicada e o
          trecho sem lastro removido pela governança.
        </Text>
        <Text
          style={{ fontSize: 9.5, fontWeight: 600, color: BLUE, marginTop: 10 }}
        >
          Nesta proposta, o Data Omnis entra como cortesia
        </Text>
      </View>
    </ContentPage>
  );
}

function ScheduleAndLgpd() {
  return (
    <ContentPage>
      <H1 n="VIII">Cronograma Estimado</H1>
      <P>
        Cronograma estimado, sujeito a confirmação na reunião de kick-off, após
        levantamento detalhado dos ambientes e sistemas da contratante,
        incluindo a integração com o provedor de identidade corporativo. Os
        prazos de execução de cada frente estão detalhados abaixo.
      </P>
      <H2>Prazos de Execução</H2>
      <Table
        cols={[
          { label: "Escopo", width: "55%" },
          { label: "Prazo", width: "45%", bold: true },
        ]}
        rows={[
          [
            "Implantação do sistema – opcional (com consultoria de governança e adoção)",
            "16 dias úteis, contados a partir do kick-off do projeto",
          ],
          [
            "Licenciamento Claude (ativação e saldo de tokens)",
            "5 dias úteis, após confirmação do pedido e recebimento dos dados do cliente",
          ],
          [
            "Treinamento para Liderança – opcional",
            "A combinar entre as partes",
          ],
          [
            "Data Omnis (cortesia)",
            "A combinar entre as partes, em paralelo à implantação",
          ],
        ]}
      />
      <H1 n="IX">Proteção de Dados e LGPD</H1>
      <P>
        A relação contratual entre as partes observará integralmente a Lei Geral
        de Proteção de Dados (Lei nº 13.709/2018), com papéis e
        responsabilidades assim definidos:
      </P>
      <Table
        cols={[
          { label: "Parte", width: "17%", bold: true },
          { label: "Papel", width: "17%", align: "center" },
          { label: "Descrição", width: "66%" },
        ]}
        rows={[
          [
            "Contratante",
            "Controladora",
            "Define as finalidades e os meios de tratamento dos dados pessoais inseridos no ambiente Claude.",
          ],
          [
            "Data Group",
            "Operadora",
            "Atua no suporte e na implantação, com acesso eventual e supervisionado ao ambiente Claude. Na plataforma Data Omnis, trata os dados conforme as regras de acesso definidas pela contratante, com registro de cada consulta.",
          ],
          [
            "Anthropic",
            "Suboperadora",
            "Processa os dados na plataforma Claude Enterprise, conforme o Acordo de Tratamento de Dados (DPA) da Anthropic, sem uso dos dados para treinamento de modelos.",
          ],
        ]}
      />
      <P>
        O tratamento segue a LGPD, que se conecta contratualmente ao DPA firmado
        entre o Data Group e a Anthropic. O acesso do Data Group ao ambiente
        Claude da contratante, quando necessário para fins de suporte ou
        implantação, ocorrerá de forma eventual e supervisionada.
      </P>
    </ContentPage>
  );
}

function CommercialTerms({ d }: { d: ProposalData }) {
  const q = d.investment.totalQuantity;
  return (
    <ContentPage>
      <H1 n="X">Condições Comerciais</H1>
      <View style={{ fontSize: 8.4 }}>
        <H3>Validade da Proposta</H3>
        <P>
          Esta proposta possui validade de 30 (trinta) dias corridos a partir da
          data de sua emissão (
          {d.validUntilLabel.replace("São Paulo, ", "até ")}
          ), podendo ser revisada após esse período.
        </P>
        <H3>Impostos</H3>
        <P>
          A proposta contempla todos os custos relacionados à execução do
          serviço, incluindo tributos e encargos aplicáveis. As notas fiscais
          são emitidas no Brasil.
        </P>
        <H3>Escopo e Entrega</H3>
        <P>
          O fornecimento dos serviços atenderá integralmente às especificações
          técnicas, prazos e quantidades definidos nesta proposta. Método de
          entrega: digital e remoto. Qualquer atividade fora deste escopo poderá
          ser objeto de orçamento complementar.
        </P>
        <H3>Condições de Pagamento</H3>
        <Bullets
          items={[
            <>
              <B>Licenciamento Team ou Enterprise:</B>{" "}
              {d.billing === "anual" ? "parcela única" : "parcela mensal"}, com
              vencimento em 10 dias a partir da emissão da nota fiscal;
            </>,
            <>
              <B>
                Serviços opcionais (Implantação e Treinamento para Liderança),
                quando contratados:
              </B>{" "}
              parcela única, com vencimento em 30 dias a partir da emissão da
              nota fiscal;
            </>,
            <>
              <B>Saldo de tokens:</B> modelo pós-pago – o Data Group adiciona o
              saldo no ambiente conforme o consumo e fatura mensalmente, com
              prazo de pagamento de 10 dias;
            </>,
            <>
              <B>Suporte Contínuo Consultivo:</B>{" "}
              {d.supportMonthlyCents > 0
                ? `${brl(d.supportMonthlyCents)}/mês para ${q} ${q === 1 ? "licença" : "licenças"}`
                : "conforme a quantidade de licenças contratadas"}
              , faturado mensalmente, com prazo de pagamento de 10 dias;
            </>,
            "Condições especiais de pagamento, com possibilidade de faturamento em boleto bancário.",
          ]}
        />
        <H3>Dados Bancários</H3>
        <P>
          Pix: 33.416.994/0001-80 | Titularidade: DATAGROUP Tecnologia da
          Informação Ltda. | CNPJ: 33.416.994/0001-80 | Praça de pagamento: São
          Paulo/SP.
        </P>
        <H3>Aceite e Contratação</H3>
        <P>
          A aprovação desta proposta poderá ser formalizada por meio de
          assinatura do documento, confirmação por e-mail ou emissão de pedido
          de compra, com possibilidade de contratação e faturamento via processo
          de suprimentos da contratante. Há agilidade nas negociações de
          upgrades, renovações ou inclusão de usuários durante a vigência.
        </P>
        <H3>Contrato Mínimo e Reajuste</H3>
        <P>
          O licenciamento Claude Enterprise e o Suporte Contínuo Consultivo
          preveem vigência mínima de 12 (doze) meses, contados a partir do
          início da prestação dos serviços. Em caso de cancelamento antes do
          término desse período, poderão ser aplicadas as condições de rescisão
          antecipada previstas em contrato. Na renovação, os valores poderão ser
          reajustados pelo IPCA ou por outro índice acordado entre as partes.
        </P>
        <H3>Rescisão Contratual</H3>
        <P>
          Após o período mínimo de vigência contratual, qualquer das partes
          poderá solicitar a rescisão do contrato mediante notificação formal
          com antecedência mínima de 60 (sessenta) dias, contados a partir da
          data de recebimento da comunicação. Durante o período de aviso prévio,
          os serviços continuarão sendo prestados normalmente.
        </P>
      </View>
    </ContentPage>
  );
}

/** Linha em branco para o cliente preencher ao fechar (não é preenchida pelo sistema). */
function FillLine({ label }: { label: string }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 9 }}
      wrap={false}
    >
      <Text style={{ fontWeight: 600, color: DARK, width: 108 }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          borderBottomWidth: 0.5,
          borderColor: "#B9BBC0",
          paddingBottom: 1,
        }}
      >
        {" "}
      </Text>
    </View>
  );
}

function ContractParameters() {
  return (
    <ContentPage bottomWave>
      <Text style={[s.h1, { fontSize: 13 }]}>PARÂMETROS CONTRATUAIS</Text>
      <P>
        Nós, na qualidade de CONTRATANTE, abaixo qualificada, declaramos, para
        os devidos fins, que lemos, compreendemos e aceitamos integralmente as
        condições estabelecidas nesta proposta, concordando com a prestação dos
        serviços conforme as regras, premissas e responsabilidades aqui
        descritas.
      </P>
      <H3>Contratante / Cliente</H3>
      <View style={{ marginTop: 4, marginBottom: 6 }}>
        {[
          "Nome:",
          "Endereço:",
          "Cidade:",
          "Estado:",
          "CEP:",
          "CNPJ/MF:",
          "Inscrição Estadual:",
          "Inscrição Municipal:",
        ].map((l) => (
          <FillLine key={l} label={l} />
        ))}
      </View>
      <H3>i. Do Reajuste dos Preços</H3>
      <P>
        Os preços estabelecidos no <B>resumo de investimento</B> desta proposta
        serão reajustados após 12 (doze) meses, contados a partir da data de
        aceite, conforme a variação acumulada do Índice Nacional de Preços ao
        Consumidor Amplo (IPCA), divulgado pelo Instituto Brasileiro de
        Geografia e Estatística (IBGE), ou por outro índice que venha a
        substituí-lo, observada a legislação aplicável.
      </P>
      <P>
        Na hipótese de alteração da legislação que permita periodicidade
        inferior para reajustes contratuais, os valores poderão ser ajustados
        conforme a periodicidade mínima legalmente permitida.
      </P>
      <P>
        Os valores das licenças poderão sofrer alterações durante a vigência
        contratual em decorrência de reajustes realizados pelo fabricante da
        solução, sobre os quais a CONTRATADA não possui controle.
      </P>
      <P>
        Nesses casos, a CONTRATADA comunicará previamente à CONTRATANTE os novos
        valores e a data prevista para sua aplicação, sendo os reajustes
        aplicáveis somente aos faturamentos posteriores à sua entrada em vigor.
      </P>
      <H3>ii. Tributos, Impostos e Taxas sobre Serviços</H3>
      <P>
        Os valores apresentados no resumo de investimento desta proposta já
        contemplam os tributos aplicáveis na data de sua elaboração.
      </P>
      <P>
        Eventuais alterações na legislação tributária que impactem diretamente
        os custos da contratação poderão resultar em revisão dos valores,
        mediante comunicação prévia à CONTRATANTE.
      </P>
      <H3>iii. Do Prazo de Contratação</H3>
      <P>
        O presente contrato terá <B>vigência de 12 (doze) meses</B>, contados a
        partir da data de seu aceite, com renovação automática por igual
        período, salvo manifestação contrária de qualquer das partes.
      </P>
      <P>
        Fica estabelecido que o prazo de 12 (doze) meses possui{" "}
        <B>
          finalidade administrativa e de controle contratual, não representando
          período mínimo de permanência ou fidelidade.
        </B>
      </P>
      <P>
        Dessa forma, o contrato poderá ser rescindido a qualquer momento,{" "}
        <B>sem aplicação de multa</B>, desde que respeitado o aviso prévio de 30
        (trinta) dias, conforme as condições de rescisão estabelecidas nesta
        proposta.
      </P>
      <H3>iv. Da Validade da Proposta</H3>
      <P>
        Esta proposta terá validade de <B>30 (trinta) dias corridos</B>,
        contados a partir da data de sua emissão.
      </P>
      <H3>v. Da Rescisão Contratual</H3>
      <P>
        O presente contrato poderá ser rescindido por qualquer das partes, a
        qualquer momento, mediante notificação formal por e-mail ou carta, com
        antecedência mínima de <B>30 (trinta) dias</B>.
      </P>
      <P>
        <B>
          Não haverá aplicação de multa rescisória quando respeitado o prazo de
          aviso prévio
        </B>
        , independentemente do período de vigência já cumprido.
      </P>
      <P>
        Em caso de cancelamento sem o cumprimento do aviso prévio estabelecido,
        será aplicada multa rescisória correspondente ao valor dos serviços
        contratados referente aos{" "}
        <B>30 (trinta) dias de aviso prévio não cumpridos</B>, proporcionalmente
        ao período faltante.
      </P>
      <P>
        Permanecem devidos os valores referentes aos serviços e licenças
        efetivamente disponibilizados até a data de encerramento contratual,
        observadas as condições de faturamento acordadas.
      </P>
      <H3>vi. Do Suporte Técnico e Responsabilidades</H3>
      <P>
        O suporte técnico prestado pela <B>Data Group</B> será limitado à gestão
        administrativa e ao licenciamento da plataforma Claude, contemplando:
      </P>
      <Bullets
        items={[
          "Liberação e habilitação de conectores e funcionalidades disponíveis no plano contratado;",
          "Solicitação e aquisição de novas licenças;",
          "Solicitação de créditos adicionais para consumo de tokens;",
          "Orientações relacionadas ao gerenciamento de usuários e permissões administrativas.",
        ]}
      />
      <P>
        A CONTRATADA não será responsável pelo funcionamento, disponibilidade,
        manutenção ou eventuais falhas da plataforma Claude, cuja operação é de
        responsabilidade do fabricante.
      </P>
      <P>
        <B>
          Fica esclarecido que a Data Group não terá acesso aos dados,
          conversas, documentos ou demais conteúdos utilizados pela CONTRATANTE
          na plataforma
        </B>
        , limitando sua atuação às atividades administrativas previstas nesta
        proposta.
      </P>
      <H3>vii. Da Autonomia Administrativa da Contratante</H3>
      <P>
        Caso a CONTRATANTE opte por possuir autonomia integral na administração
        da plataforma, poderá ser concedida a permissão de{" "}
        <B>Proprietário (Owner)</B>, permitindo o gerenciamento direto da
        organização, conforme as funcionalidades disponibilizadas pelo
        fabricante.
      </P>
      <P>
        Nessa modalidade, a CONTRATANTE assumirá integralmente a
        responsabilidade pela gestão administrativa da organização, incluindo
        usuários, permissões, licenças e créditos adicionais.
      </P>
      <P>
        A concessão dessa permissão implicará a{" "}
        <B>não prestação de suporte administrativo pela Data Group</B>, ficando
        a CONTRATANTE responsável pelas configurações, alterações e operações
        realizadas na plataforma.
      </P>
      <P>
        A Data Group permanecerá responsável exclusivamente pelas obrigações
        comerciais expressamente previstas nesta proposta, quando aplicáveis.
      </P>
    </ContentPage>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderBottomWidth: 2.5,
        borderColor: BLUE,
        paddingBottom: 4,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>
        {children}
      </Text>
    </View>
  );
}

function Conclusion({ d }: { d: ProposalData }) {
  const addr = (title: string, lines: string[]) => (
    <View style={{ marginBottom: 7 }} wrap={false}>
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: DARK }}>
        {title}
      </Text>
      {lines.map((l) => (
        <Text key={l} style={{ fontSize: 7.5 }}>
          {l}
        </Text>
      ))}
    </View>
  );
  return (
    <ContentPage>
      <View style={{ marginTop: 30, marginBottom: 36 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: BLUE,
            lineHeight: 1.3,
          }}
        >
          Conclusão de Serviços Profissionais
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: DARK,
            lineHeight: 1.3,
            marginTop: 2,
          }}
        >
          DATA GROUP
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 30 }}>
        <View style={{ width: "42%" }}>
          <ColumnTitle>Conclusão</ColumnTitle>
          <P>
            O principal objetivo do Data Group é permitir que a contratante
            adote o Claude com segurança, governança apoiada pelo Data Omnis e
            resultado desde as primeiras semanas, com um parceiro oficial da
            Anthropic ao lado em todas as etapas.
          </P>
          <P>Estamos à disposição para esclarecimentos necessários.</P>
        </View>
        <View style={{ flex: 1 }}>
          <ColumnTitle>Contato</ColumnTitle>
          {addr("Datagroup Tecnologia da Informação", [
            "CNPJ: 33.416.994/0001-80",
            "0800-590-5005 – Ramais 104/111",
            "https://datagroup.global",
          ])}
          {addr("Matriz São Paulo:", [
            "Al. Vicente Pinzon, 54 Lote 19/23 – Quadra 12",
            "Vila Olimpia – CEP: 04547-130",
            "São Paulo / SP – Brasil",
          ])}
          {addr("Matriz São Paulo:", [
            "E-OFFICE - Av. Engenheiro Luís Carlos Berrini, 1748 - Itaim Bibi",
            "CEP: 04571-000 Cj. 509, 5011",
            "São Paulo / SP - Brasil",
          ])}
          {addr("Brasília, Brasil", [
            "SCN Q 01 BL D SL Event 01 Vega Lux Brasília",
          ])}
          {addr("Lisboa, Portugal", [
            "Edifício Infante, Av. D. João II n. º35, Piso 11 A, Parque das Nações 1990-083",
          ])}
          {addr("Miami, Estados Unidos", [
            "1937 E ATLANTIC BLVD, SUITE 106, MIAMI, FL 33062",
          ])}
          <View style={{ marginTop: 6 }}>
            {d.signers.map((p) => (
              <View key={p.id} style={{ marginBottom: 7 }} wrap={false}>
                <Text style={{ fontSize: 8, fontWeight: 600, color: DARK }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 7.5 }}>{p.role}</Text>
                {p.email ? (
                  <Text style={{ fontSize: 7.5, color: BLUE }}>{p.email}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    </ContentPage>
  );
}

function ThankYou({ d }: { d: ProposalData }) {
  return (
    <Page size="A4" style={s.bluePage}>
      <View style={{ position: "absolute", top: 420, left: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: 600 }}>Obrigado</Text>
        <Text style={{ fontSize: 22, fontWeight: 600 }}>pela preferência.</Text>
        <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 60 }}>
          DATA GROUP
        </Text>
        <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 24 }}>
          {d.issuedLabel.slice(-4)}
        </Text>
      </View>
      <PdfImage src={asset("img/onda.png")} style={[s.wave, { bottom: 0 }]} />
    </Page>
  );
}

export function ProposalDocument({ d }: { d: ProposalData }) {
  return (
    <Document
      title={`Proposta Comercial - ${d.clientName}`}
      author="Data Group"
      subject="Proposta Comercial — Claude (Anthropic)"
      language="pt-BR"
    >
      <Cover d={d} />
      <Letter d={d} />
      <About />
      <Partnership />
      <WhyUs />
      <Context />
      <Solution />
      <Licensing />
      <Training d={d} />
      <Support />
      <Investment d={d} />
      <Omnis />
      <ScheduleAndLgpd />
      <CommercialTerms d={d} />
      <ContractParameters />
      <Conclusion d={d} />
      <ThankYou d={d} />
    </Document>
  );
}

/** Gera o PDF (Blob). `origin` = endereço do site, para carregar fontes e imagens. */
export async function renderProposalPdf(d: ProposalData, origin: string) {
  assetBase = origin;
  registerFonts();
  return pdf(<ProposalDocument d={d} />).toBlob();
}
