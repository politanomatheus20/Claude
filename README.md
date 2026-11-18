# Metas Claude · DataGroup

Sistema interno que substitui a planilha de controle de clientes fechados da operação Claude: registra a proposta de cada cliente, invoices, custo e resultado, e acompanha a **meta mensal** com uma barra de progresso.

> **Status:** 🟢 v0.1 funcional. ⚠️ As regras de cálculo ainda **precisam ser validadas contra a planilha original** (ela é privada e não pôde ser lida — ver [Pendências](#-pendências)).

---

## ✨ Funcionalidades

| Área | O que faz |
|---|---|
| **Login** | Apenas o e-mail. Só entra quem tem `@datagroup.global`. Depois do primeiro acesso a sessão dura **1 ano** (login automático). |
| **Painel** | Barra de progresso da meta do mês, quanto falta na **metade** e no **fim** da barra, números animados, fechamentos do mês, receita/custo/resultado e histórico de 6 meses. Navegação entre meses. |
| **Novo cliente** | Nome, CNPJ, contato, data de fechamento, **pagamento mensal ou anual**, valor das **licenças**, do **suporte**, **treinamento para liderança** (opcional), anexo da proposta e observações. Prévia do cálculo ao vivo. |
| **Atualizar proposta** | Gera uma **nova versão** (histórico imutável com motivo, autor, data e anexo). Meta, receita e resultado são recalculados na hora. |
| **Invoices** | Número, emissão, vencimento, valor, status (pendente/paga) e anexo. Somam o **custo** do cliente. |
| **Anexos** | Propostas e invoices (PDF, imagem, Office · até 10 MB), com visualização e download autenticados. |
| **Metas** | Define/edita a meta de cada mês e mostra o histórico atingido x meta. |

## 🧮 Regras de cálculo

Fonte única de verdade: [`src/lib/calc.ts`](src/lib/calc.ts) (coberto por testes em [`src/lib/calc.test.ts`](src/lib/calc.test.ts)). Valores guardados em **centavos** (inteiros).

**Convenção de entrada:** se o pagamento é **mensal**, licenças e suporte são valores **mensais**; se é **anual**, são o valor **anual** (parcela única). O treinamento é o valor total.

| Cálculo | Fórmula |
|---|---|
| Suporte mensal | Mensal: `suporte` · Anual: `suporte ÷ 12` |
| Treinamento no mês | `treinamento ÷ 12` |
| **Soma na meta (por cliente)** | `suporte mensal + treinamento ÷ 12` — **licenças não entram** |
| Meta atingida no mês | soma dos clientes cuja **data de fechamento** cai no mês |
| Receita do contrato (12m) | Mensal: `(licenças + suporte) × 12 + treinamento` · Anual: `licenças + suporte + treinamento` |
| Custo | soma das invoices do cliente |
| Resultado / margem | `receita − custo` · `resultado ÷ receita` |
| Barra | `faltam = meta − atingido` · `faltam p/ metade = ⌈meta/2⌉ − atingido` · acima de 100% mostra o excedente |

Exemplo: meta R$ 10.000; cliente mensal com suporte R$ 3.000 + cliente anual com suporte R$ 24.000 e treinamento R$ 12.000 → `3.000 + 2.000 + 1.000 = R$ 6.000` (60%, faltam R$ 4.000).

## 🎨 Identidade visual

Baseada em [datagroup.global](https://datagroup.global/pt-br/solucoes) e [claude.datagroup.global](https://claude.datagroup.global):

- Cores: `abyss #1d1d1b` / `#121211`, `mist #f7f7f7`, gradiente da marca `#024ffa → #1382e9 → #25b9d7 → #35e8c8`.
- Tipografia: **Inter Variable** (texto) e **Nixie One** (destaques), como no site.
- Login com a **água-viva** do hero do site (mesmo vídeo) e os **tentáculos bioluminescentes** do site portados para React no card da meta — os nós acendem conforme a meta avança.
- Respeita "reduzir movimento" do sistema operacional.

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 16 (App Router, Server Actions, `proxy.ts`) + React 19 + TypeScript |
| UI | Tailwind CSS 4, Radix UI, Motion, Lucide, Sonner, class-variance-authority |
| Dados | Drizzle ORM + libSQL — SQLite local, **Turso** em produção |
| Anexos | Disco local (`data/uploads`) ou **Vercel Blob** em produção |
| Sessão | JWT HS256 (`jose`) em cookie httpOnly |
| Validação | Zod 4 |

## 🗂️ Estrutura

```
src/
├─ proxy.ts                    # redireciona quem não tem sessão para /login
├─ app/
│  ├─ login/                   # tela de login + actions de login/logout
│  ├─ (app)/                   # área autenticada (sidebar)
│  │  ├─ page.tsx              # Painel
│  │  ├─ clientes/             # lista, novo, detalhe ([id]) e campos da proposta
│  │  └─ metas/                # metas mensais
│  ├─ files/[id]/route.ts      # download autenticado de anexos
│  └─ actions.ts               # todas as mutações (Server Actions)
├─ components/                 # barra de meta, tentáculos, água-viva, UI base
└─ lib/
   ├─ calc.ts                  # ★ regras de negócio
   ├─ data.ts                  # consultas (sempre autenticadas)
   ├─ db/                      # schema Drizzle + conexão
   ├─ auth/                    # sessão (JWT) e DAL
   ├─ storage.ts               # anexos (local/Blob)
   ├─ validation.ts            # schemas Zod
   └─ format.ts                # moeda BRL, datas pt-BR
drizzle/                       # migrações SQL
public/brand, public/media     # logo, favicon e vídeo da água-viva
```

## 🚀 Como rodar localmente

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env.local     # preencha SESSION_SECRET (comando no arquivo)
npm run setup                  # cria data/ e aplica as migrações
npm run dev                    # http://localhost:3000
```

| Script | Para quê |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build / produção |
| `npm test` | testes das regras de cálculo |
| `npm run lint` / `typecheck` | qualidade |
| `npm run db:generate` | gera migração após alterar `src/lib/db/schema.ts` |
| `npm run db:migrate` | aplica migrações |
| `npm run db:studio` | navegador visual do banco |

## ☁️ Deploy (Vercel + Turso + Blob)

1. Crie o banco no [Turso](https://turso.tech) e pegue URL + token.
2. Importe o repositório na Vercel e crie um **Blob Store** no projeto.
3. Variáveis de ambiente: `SESSION_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`.
4. Rode `npm run db:migrate` apontando para o Turso (com as variáveis acima no shell).

> Na Vercel o upload por request é limitado a ~4,5 MB pela plataforma.

## 🔐 Segurança

- Login sem senha nem confirmação por e-mail, **por decisão do negócio**: qualquer pessoa que digite um e-mail `@datagroup.global` válido entra. Se precisar endurecer, o próximo passo é enviar um link/código no primeiro acesso.
- Toda página, action e download revalida a sessão no servidor (`src/lib/auth/dal.ts`); o `proxy.ts` é só o redirecionamento rápido.
- Anexos só são servidos pela rota autenticada `/files/[id]`.

## 📌 Pendências

- [ ] **Validar as regras com a planilha** — ela é privada (retornou 401). Compartilhar como "qualquer pessoa com o link pode ver" ou exportar `.xlsx` para a pasta do projeto.
- [ ] Confirmar se **licenças** devem entrar na receita/resultado como implementado e se as **invoices** são custo (fornecedor) — hoje são tratadas como custo.
- [ ] Confirmar o mês em que uma **atualização de proposta** conta na meta (hoje: mês do fechamento original).
- [ ] Importar os dados atuais da planilha.

---

## 📝 Regra de documentação

**Toda alteração no sistema deve atualizar este README** no mesmo commit — funcionalidades, regras de cálculo, estrutura e instruções. Ver [CLAUDE.md](CLAUDE.md).

## 📜 Histórico de alterações

| Data | Alteração |
|---|---|
| 2026-11-17 | Repositório conectado ao GitHub; README inicial com escopo do sistema. |
| 2026-11-17 | v0.1: login por domínio com sessão persistente, painel com barra de meta (metade/fim, animada), cadastro de clientes, versões de proposta, invoices, anexos, metas mensais, identidade visual DataGroup (água-viva + tentáculos), testes das regras de cálculo. |
