# CampusShare

App de caronas universitárias para Android e iOS. Só alunos com e-mail institucional verificado entram, e o valor da viagem é rateado e pago dentro do app, sem acerto em dinheiro entre motorista e passageiro.

> Projeto da disciplina **Projeto de Desenvolvimento de Negócios** — ADS · ULBRA Campus Torres · 2026/2
> Squad: Ryan Lopes · Kauã Aguiar · Gustavo Trespach

## Funcionalidades do MVP

- Cadastro restrito ao domínio `@ulbra.br`, com confirmação por e-mail
- Login com Supabase Auth (sessão JWT)
- Cadastro de veículo e publicação de carona com horário exato de partida
- Busca de caronas por proximidade, com filtro "somente mulheres"
- Reserva de vaga com cálculo automático do rateio
- Pagamento via Pix (sandbox Mercado Pago)
- Notificação de reserva e de cancelamento
- Avaliação mútua após a viagem

## Stack

React Native + Expo (TypeScript) · Supabase (Auth, PostgreSQL + RLS, funções SQL/RPC, Edge Functions em Deno/TypeScript, pg_cron) · Expo EAS Build

Não há servidor próprio (Node.js/Express): o backend é o projeto Supabase — ver [ADR-009](docs/adr/ADR-009-backend-supabase.md).

## Pré-requisitos

- Node.js 20 LTS e npm (somente para o app Expo)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker Desktop (para rodar o Supabase localmente)
- Conta no Supabase
- App **Expo Go** no celular
- Chaves: Google Maps, Resend (SMTP) e Mercado Pago (sandbox)

## Como rodar

```bash
git clone <url-do-repositorio>
cd campusshare

# Backend (Supabase local)
supabase start                          # sobe Postgres, Auth, Edge Runtime e o Studio (Docker)
supabase db reset                       # aplica migrations + seed.sql
cp supabase/functions/.env.example supabase/functions/.env   # segredos das Edge Functions
supabase functions serve                # http://localhost:54321/functions/v1/health

# App (em outro terminal)
cd mobile
npm install
cp .env.example .env        # URL e anon key exibidas pelo `supabase start`
npx expo start              # leia o QR code com o Expo Go
```

E-mails enviados pelo Auth local (confirmação de cadastro) aparecem no Mailpit: `http://localhost:54324`.

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Edge Functions | Directions API (distância da rota) |
| `MP_ACCESS_TOKEN` | Edge Functions | Mercado Pago (sandbox) |
| `MP_WEBHOOK_SECRET` | Edge Functions | Validação da assinatura do webhook |
| `EXPO_ACCESS_TOKEN` | Edge Functions | Envio de push pela Expo (opcional) |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | Chave pública (anon/publishable) — a proteção vem da RLS |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | mobile | Exibição do mapa |

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente nas Edge Functions.
- Em produção, os segredos das Edge Functions são definidos com `supabase secrets set`.
- O SMTP do Resend é configurado no Supabase Auth (painel → Authentication → SMTP), não em variável do app.

## Documentação

| Arquivo | Para quê |
|---|---|
| [AGENTS.md](AGENTS.md) | Regras do projeto para pessoas e agentes de IA |
| [SPEC.md](SPEC.md) | Especificação funcional |
| [TASKS.md](TASKS.md) | Backlog técnico por sprint |
| [MEMORY.md](MEMORY.md) | Diário de bordo e estado atual |
| [docs/architecture.md](docs/architecture.md) | Arquitetura e fluxos |
| [docs/adr/](docs/adr/) | Decisões de arquitetura |
| [docs/DATABASE.md](docs/DATABASE.md) | Modelo de dados e RLS |
| [docs/API.md](docs/API.md) | Contratos do backend (tabelas, RPC, Edge Functions) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Padrão de código e Git |
| [docs/SECURITY.md](docs/SECURITY.md) | Segurança |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Negócio e glossário |

## Contribuindo

Branches `feature/<ID-da-tarefa>-<resumo>` a partir de `develop`, commits no padrão Conventional Commits e Pull Request revisado por outro membro. Detalhes em [docs/CONVENTIONS.md](docs/CONVENTIONS.md).
