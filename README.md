# Metas Claude · DataGroup

Sistema interno que substitui a planilha de controle de clientes fechados da operação Claude: registra a proposta de cada cliente, invoices, custo e resultado, e acompanha a **meta mensal** com uma barra de progresso.

> **Status:** 🟢 v0.2 — cálculos idênticos à planilha **CLAUDE DATAGROUP 2026** (289 valores conferidos, 0 divergências).

---

## ✨ Funcionalidades

| Área | O que faz |
|---|---|
| **Login** | Apenas o e-mail. Só entra quem tem `@datagroup.global`. Depois do primeiro acesso a sessão dura **1 ano** (login automático). |
| **Painel** | Barra de progresso da meta do mês (quanto falta na **metade** e no **fim**), fechamentos do mês, valor anual / custo / consultoria / resultado, carteira total, últimos 6 meses e alertas de vigência e pendências. |
| **Planilha** | Todas as colunas **A → AJ** em **tela inteira** (com modo *Tela cheia*), **editáveis como no Excel/Sheets**: duplo clique, Enter ou digitar para editar; Enter/Tab salva; setas navegam; Delete limpa e volta à fórmula. Cada alteração **recalcula na hora** (N, T, AC, totais, meta) e é salva automaticamente, com registro no histórico do contrato. Colunas calculadas (N, T, AC, AD, AE, AF) não são editáveis. Seção **Atualização**, filtros e exportação CSV. Valores digitados à mão aparecem em amarelo. |
| **Clientes** | Lista em **tela inteira** (cabeçalho e total fixos): assinatura, modalidade, quantidade, valor anual, total licença, resultado (margem no tooltip), soma na meta, saldo a receber, vigência em dias e status de faturamento/licenças. Cadastro com prévia do cálculo ao vivo; cada cliente pode ter vários contratos e **atualizações** (aditivos de licenças). |
| **Atualizar contrato** | Gera uma nova versão no histórico (motivo, autor, data, anexo) e recalcula tudo. |
| **Financeiro** | Parcelas, valor por parcela, recebimentos (botão *Recebimento*), saldo a receber e situação financeira. |
| **Invoices e anexos** | Invoices para conferir o custo previsto (coluna R) e anexos de propostas, com download autenticado. |
| **Metas** | Define/edita a meta de cada mês e mostra o histórico atingido x meta. |
| **Calculadora** | Simulador de proposta de licenças de IA (Claude Team Standard/Premium, ChatGPT Business), abas **Mensal** e **Anual** — réplica de `Calculadora_De_Licencas.xlsx`: custo em dólar → custo em reais (c/ IOF) → preço ao cliente → imposto, resultado e margem. Ao lado, **tabela de apoio** com o preço de referência (zero margem) e a sugestão com margem; botão *Usar* aplica o valor direto na calculadora. Ferramenta de simulação — não grava nada no banco. |

## 🧮 Regras de cálculo (= planilha)

Fonte única de verdade: [`src/lib/calc.ts`](src/lib/calc.ts). Sem arredondamento intermediário (como o Google Sheets); arredonda só na exibição.

| Col. | Campo | Fórmula |
|---|---|---|
| K | Valor mensal | digitado · ou `L ÷ 12` |
| L | Valor anual | `K × 12` · ou digitado |
| M | Imposto NF | `L × 12%` · ou digitado |
| N | Valor líquido | `L − M` |
| O | Valor Claude mensal | digitado |
| P | Valor licença anual | `O × 12` · ou digitado |
| Q | IOF | `P × 3,5%` · ou digitado |
| R | Total licença | `P + Q` · ou digitado |
| S | Consultoria | suporte no ano (mensal × 12 ou anual) + treinamento |
| **T** | **Resultado** | **`N − R + S`** |
| Z | Nº de parcelas | digitado · ou 12 (mensal) / 1 (anual) |
| AA | Valor por parcela | `L ÷ Z` · ou digitado |
| AC | Saldo a receber | `AA × Z − AB` |
| AD | Situação da vigência | ativo · a vencer (≤ 60 dias) · vencido · sem data |
| AE | Dias até vencer | `H − hoje` (calculado todo dia) |
| AF | Situação financeira | a receber se saldo > 0 |

"Ou digitado": quando a planilha tem um valor fixo no lugar da fórmula (ex.: IOF real), ele fica salvo como **ajuste manual** e prevalece — igual à planilha.

**Meta mensal:** soma só a consultoria — suporte do mês (anual ÷ 12) + treinamento de liderança ÷ 12 (= `S ÷ 12`). Conta no mês da **data de assinatura** (F); atualizações sem assinatura contam no mês de **início** (G).

### Importar / conferir a planilha

```bash
npm run import:planilha -- "C:/caminho/CLAUDE DATAGROUP 2026.xlsx" --check    # só confere, linha a linha
npm run import:planilha -- "C:/caminho/CLAUDE DATAGROUP 2026.xlsx"            # importa (banco vazio)
npm run import:planilha -- "C:/caminho/CLAUDE DATAGROUP 2026.xlsx" --replace  # apaga clientes/contratos e reimporta
```

O importador lê fórmulas e valores, detecta o que foi digitado à mão e compara cada coluna calculada pelo sistema com a planilha. Se houver qualquer divergência, ele não grava.

> 🔒 O repositório é **público**: a planilha e os dados dos clientes **nunca** vão para o Git (ficam só em `data/`, que é ignorado).

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
│  │  ├─ clientes/             # lista, novo, detalhe ([id]), campos de cliente e contrato
│  │  ├─ planilha/             # visão com todas as colunas A → AJ
│  │  ├─ metas/                # metas mensais
│  │  └─ calculadora/          # simulador de proposta de licenças (mensal/anual)
│  ├─ files/[id]/route.ts      # download autenticado de anexos
│  └─ actions.ts               # todas as mutações (Server Actions)
├─ components/                 # barra de meta, tentáculos, água-viva, UI base
└─ lib/
   ├─ calc.ts                  # ★ regras de negócio (= fórmulas da planilha)
   ├─ labels.ts                # rótulos de status
   ├─ sheet-edit.ts            # regra de edição célula a célula (navegador e servidor)
   ├─ data.ts                  # consultas (sempre autenticadas)
   ├─ db/                      # schema Drizzle + conexão
   ├─ auth/                    # sessão (JWT) e DAL
   ├─ storage.ts               # anexos (local/Blob)
   ├─ validation.ts            # schemas Zod
   └─ format.ts                # moeda BRL, datas pt-BR
scripts/import-planilha.ts     # importação + conferência linha a linha
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
| `npm run import:planilha` | importa/confere a planilha (ver acima) |
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

- [ ] Confirmar a regra da meta (consultoria ÷ 12, pelo mês da assinatura) — a planilha não tem coluna de meta.
- [ ] Linhas da seção **Atualização** (Grupasso, ENW, Nutrimental) repetem o valor mensal do contrato original com quantidade menor — conferir se os valores estão certos na planilha.
- [ ] Ajustar nomes importados que são códigos (SECOM, Venosan).
- [ ] ENW, Semantix e SESI não têm data de assinatura: não entram na meta de nenhum mês.

## 📜 Histórico de alterações

- **2026-11-18** — Corrigida condição de corrida na edição da Planilha: `updateSheetCell` agora valida a versão do contrato (como `updateContract` já fazia) e trata o conflito com uma mensagem, em vez de deixar a edição falhar silenciosamente quando duas células da mesma linha eram salvas quase ao mesmo tempo.
- **2026-11-18** — Corrigida a seleção/edição de célula na Planilha ficando "grudada" no índice errado depois de buscar ou trocar um filtro (podia acabar editando a linha errada).
- **2026-11-18** — Servidor "aquece" a conexão com o banco assim que sobe (`src/instrumentation.ts`), eliminando a demora da primeira requisição (login/painel) logo após um deploy/restart.
- **2026-11-18** — Nova **Calculadora** de proposta de licenças (abas Mensal/Anual, réplica de `Calculadora_De_Licencas.xlsx`), com tabela de apoio (preço zero margem / sugestão com margem) ao lado.
- **2026-11-18** — Corrigido logout ao navegar: o cookie de sessão só usa `Secure` na Vercel (`VERCEL`), não em qualquer `NODE_ENV=production` — evitava que o navegador descartasse o cookie fora de HTTPS.
- **2026-11-18** — Removido o cursor de texto (I-beam) do título decorativo da tela de login.
- **2026-11-18** — O vídeo da água-viva do login agora sempre toca, mesmo com "reduzir movimento" ativado no sistema.

---

## 📝 Regra de documentação

**Toda alteração no sistema deve atualizar este README** no mesmo commit — funcionalidades, regras de cálculo, estrutura e instruções. Ver [CLAUDE.md](CLAUDE.md).

## 📜 Histórico de alterações

| Data | Alteração |
|---|---|
| 2026-11-17 | Repositório conectado ao GitHub; README inicial com escopo do sistema. |
| 2026-11-17 | v0.1: login por domínio com sessão persistente, painel com barra de meta (metade/fim, animada), cadastro de clientes, versões de proposta, invoices, anexos, metas mensais, identidade visual DataGroup (água-viva + tentáculos), testes das regras de cálculo. |
| 2026-11-17 | v0.2: modelo refeito com base na planilha real — contratos (A→AJ), fórmulas idênticas (N, R, T…), ajustes manuais, atualizações, financeiro (parcelas, recebido, saldo), vigência, visão Planilha com totais/filtros/exportação, importador com conferência (289 valores, 0 divergências). |
| 2026-11-17 | v0.3: Planilha editável célula a célula com recálculo instantâneo e gravação automática (histórico por edição); tela inteira + modo tela cheia; testes da edição. |
| 2026-11-17 | Textos explicativos removidos do login, do painel e da tela de metas. |
| 2026-11-17 | Lista de Clientes em tela inteira, compacta para caber sem rolagem lateral a partir de 1440px, com linha de total. |
| 2026-11-18 | Layout responsivo revisado em Calculadora, Planilha e Clientes: nada cortado (texto longo quebra linha), nada sobreposto, tela inteira em qualquer tamanho. Auditoria automática em 15 tamanhos de tela (360px a 4K) × 5 telas: 0 problemas. |
