# MEMORY.md — Diário de Bordo

> Atualize ao final de **cada sessão de trabalho** (humana ou com IA). Mais recente no topo do "Histórico".
> Serve para qualquer agente, IDE ou colega continuar de onde parou.

## Contexto atual

Fase de preparação para a Sprint 1 (Aula 10). Arquitetura e DER definidos na Aula 08; padrões, Git e arquivos para IA definidos na Aula 09. **Backend trocado de Node.js/Express para Supabase direto** (Auth + RLS + funções SQL + Edge Functions — ADR-009). Fundação pronta (T01–T04): Supabase local com Edge Function `health` e app Expo em `mobile/`.

## Progresso recente

- [x] Arquitetura, stack e DER documentados (Aula 08 — 17/09)
- [x] AGENTS.md, SPEC.md, TASKS.md, MEMORY.md, ADRs e docs complementares criados (Aula 09 — 24/09)
- [x] Documentação revisada para backend no Supabase, sem Node.js/Express (ADR-009 — 24/09)
- [x] T01 — Criar repositório e branches (01/10)
- [x] T02 — Estrutura inicial e documentação (01/10)
- [x] T03 — Inicializar o Supabase (01/10)
- [x] T04 — Inicializar o app (01/10)

## Próximos passos

1. Padrão de erros e validação (T05).
2. Schema inicial com RLS (T06), dados iniciais (T07) e configuração do Auth (T08).

## Decisões a confirmar com o squad

- [x] **Domínio institucional:** confirmado como `@rede.ulbra.br` (Gustavo, 01/10). Docs atualizados; a T07 deve gravar `dominio_email = rede.ulbra.br`.
- [ ] **`n_ocupantes` do rateio:** o motorista entra na divisão? Proposta: `n_ocupantes = vagas oferecidas + 1` (motorista incluso), fixado na publicação — assim o valor por passageiro não muda conforme outros reservam.
- [ ] **Prazo de expiração da reserva PENDENTE:** proposta de 15 minutos.
- [ ] **Percentual da taxa da plataforma:** definir valor inicial em PARAMETRO_CUSTO.
- [ ] **Reembolso em cancelamento:** no MVP (sandbox), apenas registrar status; definir regra para produção.
- [x] **Estratégia de branches:** `develop` + `feature/T<ID>-...` (adotada na T01, 01/10). `main` e `develop` protegidas: merge só por PR, **0 aprovações** (decisão do Gustavo, que valida e faz o merge sozinho), sem force-push e sem deleção.
- [ ] **Aprovar no DER** a saída de `senha_hash`/`email_verificado` de USUARIO (passam ao Supabase Auth) — ver `docs/DATABASE.md`.
- [ ] **Destino do link de confirmação de e-mail:** deep link do app ou página simples de "conta confirmada".

## Notas para o próximo agente

- Leia `AGENTS.md` antes de tudo; regras de negócio estão em `SPEC.md` (RN01–RN19).
- Segredos ficam no `.env` (modelo em `.env.example`). Nunca versionar chaves.
- Não existe servidor Node.js/Express nem Render: o backend é o projeto Supabase (ADR-009). Tudo que muda o banco vai em `supabase/migrations`.
- Desenvolvimento local exige Docker (`supabase start`). E-mails do Auth local aparecem no Mailpit (`localhost:54324`).
- `seed.sql` só roda localmente; dados essenciais (ULBRA, PARAMETRO_CUSTO) vão em migration.
- O projeto free do Supabase pausa após ~7 dias sem uso: reativar pelo painel antes da demo.

## Histórico

- **01/10/2026** — T01 a T04 (Fase 0): `develop` criada e protegida (PR obrigatório, 0 aprovações, por decisão do Gustavo); estrutura `supabase/` + `mobile/` e `.gitignore`; `supabase init` com Edge Function `health` (handler + teste `deno test`); app Expo SDK 57 (TypeScript strict, ESLint + Prettier) com tela "CampusShare". Domínio institucional confirmado: `rede.ulbra.br`.
- **24/09/2026** — Decisão: backend direto no Supabase, sem Node.js/Express/Render/Prisma (ADR-009). Docs e backlog revisados (T01–T31).
- **24/09/2026** — Aula 09: criados os arquivos de contexto para IA e o backlog técnico (T01–T34).
- **17/09/2026** — Aula 08: arquitetura, stack, DER e UML (Casos de Uso + Sequência UC05).
