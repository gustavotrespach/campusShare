# ADR-009: Backend direto no Supabase (sem Node.js/Express)

## Status
Aceito — substitui ADR-002 e ADR-004; substitui parcialmente ADR-003 (Prisma e "app não acessa o Supabase")

## Data
2026-09-24

## Contexto
O plano original previa uma API própria em Node.js + Express, hospedada no Render, acessando o Supabase via Prisma. Para o prazo da AP2 (cerca de 4 semanas) e um squad de três pessoas, isso significa manter um servidor a mais: autenticação e JWT feitos à mão, envio de e-mail, deploy, cold start do Render free (~30–50 s) e uma camada de código (routes → controller → service) que em boa parte só repassa dados ao banco.

O Supabase, que já era o banco, oferece os blocos que essa API reimplementaria: autenticação com confirmação de e-mail, API de dados sobre o Postgres protegida por Row Level Security (RLS), funções SQL chamáveis por RPC, Edge Functions para código com segredos/integrações e agendamento com pg_cron.

## Decisão
O backend passa a ser **o próprio projeto Supabase**. Não haverá servidor Node.js/Express nem Render.

| Necessidade | Onde fica |
|---|---|
| Cadastro, confirmação de e-mail, login, sessão | **Supabase Auth** (SMTP do Resend) |
| Validação do domínio institucional (RN01) | Auth Hook **Before User Created** (função SQL) |
| Leitura/escrita simples (perfil, veículos, notificações) | Tabelas via **supabase-js**, protegidas por **RLS** |
| Regras de negócio com transação (publicar, reservar, cancelar, concluir, avaliar, confirmar pagamento) | **Funções SQL** (`plpgsql`, `SECURITY DEFINER`) chamadas por **RPC** |
| Integrações com segredo (Mercado Pago, Directions API, Expo Push) e webhook | **Edge Functions** (Deno + TypeScript) |
| Expiração de reservas pendentes | **pg_cron** |
| Envio de push após eventos | Trigger grava NOTIFICACAO → **Database Webhook** → Edge Function |
| Schema e dados iniciais | **Migrations SQL** do Supabase CLI (`supabase/migrations`) |

As regras de negócio continuam **fora do app** (ADR-005): "servidor" passa a significar funções SQL, políticas RLS, constraints e Edge Functions.

## Alternativas consideradas
- **Manter Node.js + Express no Render** — mais código e infraestrutura para manter no prazo; cold start prejudica a demo.
- **App falando com as tabelas sem RLS/funções (BaaS "puro")** — colocaria rateio, teto e controle de vagas no cliente; rejeitado pelo ADR-005.
- **Firebase** — sem integridade relacional/transações para o N:N de reservas (mesmo motivo do ADR-003).

## Consequências
- Positivo: sem servidor para hospedar; Auth, e-mail de confirmação, rate limit de login e HTTPS prontos.
- Positivo: controle de vagas numa única função SQL com `SELECT ... FOR UPDATE` — a transação fica junto dos dados.
- Positivo: RLS garante "cada um só vê o que é seu" mesmo se o app for modificado.
- Positivo: TypeScript continua no app e nas Edge Functions; tipos do banco gerados com `supabase gen types typescript`.
- Negativo: parte das regras fica em SQL/plpgsql — o squad precisa aprender RLS e funções no Postgres; testes com pgTAP (`supabase test db`).
- Negativo: RLS mal escrita vaza dados — toda tabela nova exige política revisada e testada.
- Negativo: acoplamento maior ao Supabase (Auth e Edge Functions); o banco em si continua sendo Postgres padrão.
- Negativo: Edge Functions rodam em Deno, não em Node — algumas bibliotecas npm precisam do prefixo `npm:` ou de alternativa.
- Negativo: projeto free do Supabase pausa após inatividade — reativar antes da demo.
