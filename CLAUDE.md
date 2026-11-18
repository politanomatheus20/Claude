@AGENTS.md

# Regras do projeto

## Documentação (obrigatório)
- **Sempre que qualquer coisa for alterada no projeto, atualize o `README.md` no mesmo commit.**
  - Atualize as seções afetadas (funcionalidades, regras de cálculo, estrutura, como rodar, pendências).
  - Adicione uma linha em "📜 Histórico de alterações" com a data e o resumo da mudança.
- Nunca faça commit de código sem o README refletir o estado atual do sistema.

## Repositório
- Remote: https://github.com/politanomatheus20/Claude.git (branch `main`).

## Idioma
- Interface, documentação e mensagens de commit em **português (BR)**.

## Código
- Regras de negócio **somente** em `src/lib/calc.ts`, com teste em `src/lib/calc.test.ts`. Nunca recalcule em telas.
- Dinheiro sempre em **centavos** (inteiro).
- Toda leitura/mutação passa por `requireUser()` (`src/lib/auth/dal.ts`).
- Next.js 16: ler `node_modules/next/dist/docs/` antes de usar APIs novas (`proxy.ts` no lugar de middleware).
- Antes de commitar: `npm test && npm run lint && npm run typecheck && npm run build`.
- Ao mudar o schema: `npm run db:generate` e commitar a migração em `drizzle/`.
