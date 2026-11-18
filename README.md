# Sistema de Gestão de Clientes e Metas — DataGroup

Sistema interno para substituir e melhorar a planilha de controle de clientes fechados, propostas, receitas, custos e acompanhamento da meta mensal.

> **Status:** 🟡 Em planejamento — aguardando link do site (identidade visual) e da planilha (lógica de cálculo).

---

## 🎯 Objetivo

Centralizar o processo comercial/financeiro pós-fechamento:

- Registrar cada **cliente novo (fechado)** e sua **proposta**.
- Calcular automaticamente receita, custo e resultado.
- Acompanhar visualmente o progresso da **meta mensal**.

## 📋 Funcionalidades planejadas

### 1. Cadastro de cliente / proposta
| Campo | Descrição |
|---|---|
| Cliente | Nome do cliente fechado |
| Tipo de pagamento | **Mensal** ou **Anual** |
| Valor das licenças | Valor da proposta referente às licenças |
| Valor do suporte | Valor da proposta referente ao suporte |
| Treinamento de liderança | Opcional — valor, se fechado |
| Anexo da proposta | Upload do arquivo da proposta (PDF etc.) |
| Invoices | Registro/anexo das invoices |
| Custo | Custo associado ao cliente |
| Resultado | Calculado automaticamente (receita − custo) |

### 2. Atualização de proposta
- Campo/ação de **atualizar proposta** do cliente.
- Ao atualizar, todos os cálculos (resultado, meta, progresso) são refeitos automaticamente.
- Histórico de versões da proposta.

### 3. Barra de progresso da meta mensal
- Meta mensal configurável.
- **Considera apenas o suporte** (+ treinamento de liderança, quando houver).
- Regras de cálculo da contribuição mensal:
  - **Pagamento mensal:** usa o valor mensal do suporte diretamente.
  - **Pagamento anual:** valor do suporte ÷ 12.
  - **Treinamento de liderança:** valor ÷ 12.
- A barra avança conforme novos clientes são fechados/atualizados.
- Exibe no meio e no final da barra **quanto falta** para bater a meta.

> ⚠️ As regras acima serão validadas contra a lógica da planilha original.

### 4. Acesso / login
- Login apenas com **e-mail**.
- Somente e-mails do domínio **`@datagroup.global`** podem entrar.
- Após o primeiro acesso, o login seguinte é **automático** (sessão persistente).

### 5. Identidade visual
- Cores, logo e nome seguindo o padrão da empresa (baseado no site institucional).

---

## 🗂️ Estrutura do projeto

_A definir na primeira versão do código._

## 🚀 Como rodar

_A definir na primeira versão do código._

---

## 📝 Regra de documentação

**Toda alteração no sistema deve atualizar este README** no mesmo commit — funcionalidades, regras de cálculo, estrutura e instruções de uso. Ver [CLAUDE.md](CLAUDE.md).

## 📜 Histórico de alterações

| Data | Alteração |
|---|---|
| 2026-11-17 | Repositório conectado ao GitHub; README inicial com escopo do sistema. |
