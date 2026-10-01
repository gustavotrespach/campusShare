# AGENTS.md — CampusShare

> Guia para qualquer agente de IA (Claude Code, Copilot, Cursor, Gemini CLI…) e para membros novos do squad.
> **Leia este arquivo inteiro antes de alterar qualquer código.** Depois leia `MEMORY.md` (estado atual) e `TASKS.md` (o que fazer).

## Visão geral do projeto

CampusShare é um app de caronas entre estudantes da mesma instituição (ULBRA — Campus Torres).
Dois diferenciais sustentam o produto:

1. **Segurança:** só entra quem confirma um e-mail do domínio institucional (`@ulbra.br`).
2. **Sem constrangimento com dinheiro:** o valor é rateado e pago dentro do app (Pix).

O mesmo usuário pode ser motorista ou passageiro. Não existem tipos de conta separados.

- Squad: Ryan Lopes · Kauã Aguiar · Gustavo Trespach
- Disciplina: Projeto de Desenvolvimento de Negócios (ADS 2026/2) — prof. Juliano Ramos Matos
- Prazo do MVP: **AP2 em 22/10/2026**. Orçamento: **zero** (só planos gratuitos).

Documentos de referência:

| Arquivo | Conteúdo |
|---|---|
| `SPEC.md` | Requisitos, user stories, regras de negócio, casos de borda |
| `docs/architecture.md` | Arquitetura, stack, fluxos (o "plano" do SDD) |
| `docs/adr/` | Por que cada decisão técnica foi tomada |
| `docs/DATABASE.md` | Schema, dicionário de dados, cardinalidades, RLS |
| `docs/API.md` | Contratos do backend: tabelas expostas, funções RPC e Edge Functions |
| `docs/CONVENTIONS.md` | Padrão de código, Git e commits (detalhado) |
| `docs/SECURITY.md` | Autenticação, RLS, segredos, validações |
| `docs/CONTEXT.md` | Negócio, personas e glossário |

## Stack tecnológico

| Camada | Tecnologia |
|---|---|
| App (Android + iOS) | React Native + Expo, TypeScript, `@supabase/supabase-js` |
| Autenticação | Supabase Auth (confirmação de e-mail via SMTP do Resend) |
| Banco e regras transacionais | PostgreSQL (Supabase, free tier) com RLS e funções SQL (`plpgsql`) chamadas por RPC |
| Integrações e webhook | Supabase Edge Functions (Deno + TypeScript) |
| Rotinas agendadas | pg_cron |
| Build do app | Expo EAS Build (instalação direta, sem lojas) |
| Terceiros | Google Maps (Maps + Directions), Expo Notifications, Mercado Pago Pix (sandbox), Resend (SMTP) |

**Não há servidor Node.js/Express** (ADR-009). O backend é o projeto Supabase.

## Convenções de código

- **TypeScript em tudo** (app e Edge Functions), com `strict: true`. Proibido `any` (use `unknown` e faça narrowing).
- `camelCase` para variáveis e funções TS; `PascalCase` para componentes, tipos e interfaces; `UPPER_SNAKE_CASE` para constantes e enums.
- Arquivos TS: `kebab-case.ts`; componentes React em `PascalCase.tsx`. Edge Functions: uma pasta `kebab-case` por função (`reservar-vaga/index.ts`).
- Banco em `snake_case` (igual ao DER): tabelas, colunas, funções SQL (`reservar_vaga`) e parâmetros com prefixo `p_` (`p_id_carona`).
- Tipos do banco no TS: gerados com `supabase gen types typescript` — nunca escritos à mão.
- Sempre `async/await`; nunca `.then()` encadeado.
- Código e identificadores em **português do domínio** (`carona`, `reserva`, `rateio`); termos técnicos em inglês quando consagrados (`hook`, `trigger`, `policy`).
- Comentários explicam o **porquê**, não o quê.
- Formatação: Prettier + ESLint no app; `deno fmt` + `deno lint` nas Edge Functions (2 espaços, aspas simples, ponto e vírgula, largura 100). Rodar antes de todo commit.
- Detalhes completos em `docs/CONVENTIONS.md`.

## Estrutura de pastas

```
campusshare/
├── AGENTS.md  README.md  SPEC.md  TASKS.md  MEMORY.md
├── docs/
│   ├── architecture.md  CONVENTIONS.md  CONTEXT.md
│   ├── DATABASE.md  API.md  SECURITY.md
│   └── adr/                  # ADR-001, ADR-002…
├── supabase/                 # Backend (Supabase CLI)
│   ├── config.toml           # Auth, hooks, Edge Functions (verify_jwt), local
│   ├── migrations/           # SQL versionado: tabelas, RLS, funções, triggers, cron
│   ├── seed.sql              # dados de desenvolvimento (só local)
│   ├── functions/            # Edge Functions (Deno + TypeScript)
│   │   ├── _shared/          # cliente Supabase, erros, CORS, schemas Zod
│   │   ├── health/
│   │   ├── reservar-vaga/
│   │   ├── webhook-mercado-pago/
│   │   ├── sugestao-preco/  publicar-carona/
│   │   └── enviar-push/
│   └── tests/                # pgTAP (RLS e funções SQL)
└── mobile/                   # App (Expo)
    ├── app/                  # telas (Expo Router)
    ├── src/
    │   ├── components/  hooks/
    │   ├── services/         # único lugar que usa o cliente Supabase
    │   ├── store/  types/  utils/
    └── tests/
```

Onde cada coisa vai no backend:
- **Leitura/escrita simples do próprio usuário** (perfil, veículos, notificações): tabela direta pelo supabase-js, protegida por **RLS**.
- **Regra de negócio com transação ou que envolve várias tabelas** (publicar, buscar, reservar, cancelar, concluir, avaliar, confirmar pagamento): **função SQL** chamada por `supabase.rpc()`. As tabelas envolvidas não aceitam INSERT/UPDATE direto do app.
- **Precisa de segredo ou serviço externo** (Mercado Pago, Directions, Expo Push, webhook): **Edge Function**, que valida a entrada com Zod e chama as funções SQL.
- Cada módulo (auth, veiculos, caronas, reservas, pagamentos, notificacoes, avaliacoes) é dono das próprias tabelas; outro módulo usa as **funções** dele, não escreve nas tabelas dele.

## Comandos úteis

```bash
# Backend
supabase start                        # Supabase local (Docker)
supabase migration new <descricao>    # cria arquivo em supabase/migrations
supabase db reset                     # recria o banco local: migrations + seed.sql
supabase test db                      # testes pgTAP (RLS e funções)
supabase functions serve              # Edge Functions locais
supabase gen types typescript --local > mobile/src/types/database.ts
deno fmt && deno lint && deno test    # dentro de supabase/functions

# App
cd mobile
npm install
npx expo start                        # abrir no Expo Go pelo QR code
npm run lint
```

## Fluxo de trabalho (obrigatório)

1. Pegue **uma** tarefa do `TASKS.md` com status `a fazer` e dependências `feito`. Mude para `em andamento`.
2. Crie a branch a partir de `develop`: `feature/T06-schema-inicial` (ID da tarefa + resumo).
3. Implemente **somente** o escopo da tarefa e cumpra o critério de aceite.
4. Commits em Conventional Commits, em português: `feat(auth): valida domínio institucional no cadastro`.
5. Abra PR para `develop` com: tarefa, o que foi feito, como testar. Outro membro revisa antes do merge.
6. Marque a tarefa como `feito` e atualize o `MEMORY.md`.

## Regras e restrições para a IA

**Nunca:**
- Alterar o schema do banco sem atualizar `docs/DATABASE.md` e o DER (Aula 08) — e sempre por migration (`supabase migration new`). Nunca alterar tabelas pelo painel (Table Editor) do projeto remoto.
- Colocar regra de negócio no app: **rateio, teto de preço, validação de domínio, taxa e controle de vagas ficam no backend** — funções SQL, RLS ou Edge Functions (ver ADR-005 e ADR-009).
- Deixar o valor da carona ultrapassar `custo_estimado` quando ele existir (ver ADR-007).
- Marcar reserva como `CONFIRMADA` sem o webhook de pagamento (ver ADR-008).
- Usar a `service_role` key no app, ou em qualquer lugar fora das Edge Functions.
- Criar tabela sem RLS habilitada, ou política `using (true)` para escrita.
- Commitar `.env`, chaves de API, tokens ou senhas. Segredos só em `.env` local e em `supabase secrets` (e `.env.example` sem valores).
- Adicionar serviço pago, dependência pesada ou nova biblioteca sem registrar o motivo no PR (e em ADR se for estrutural).
- Criar servidor próprio (Node.js/Express ou outro), microsserviços, GraphQL ou outro banco — o backend é o Supabase (ADR-009).
- Fazer commit direto na `main` ou na `develop`.
- Implementar mais de uma tarefa do `TASKS.md` por branch.

**Sempre:**
- Toda função SQL e Edge Function nova tem pelo menos 1 teste antes do PR (pgTAP ou `deno test`); toda política RLS nova tem teste de acesso negado.
- Operações que alteram vagas (reserva, cancelamento, expiração) rodam **dentro de uma única função SQL**, com `SELECT ... FOR UPDATE` na carona.
- Funções `SECURITY DEFINER` usam `set search_path = ''`, nomes qualificados (`public.carona`) e tiram o `EXECUTE` de `public`/`anon`.
- O usuário logado vem de `auth.uid()` (SQL) ou do JWT validado (Edge Function) — nunca de um parâmetro enviado pelo app.
- Valores monetários em **centavos (inteiro)** no TypeScript e `DECIMAL(10,2)`/`numeric` no banco — nunca `float` para dinheiro.
- Datas salvas em UTC (`timestamptz`); exibidas em `America/Sao_Paulo`.
- Em dúvida sobre uma regra, consulte `SPEC.md`; se não estiver lá, **pergunte ao squad** em vez de inventar, e registre a dúvida no `MEMORY.md`.
