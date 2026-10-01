# MEMORY.md — Diário de Bordo

> Atualize ao final de **cada sessão de trabalho** (humana ou com IA). Mais recente no topo do "Histórico".
> Serve para qualquer agente, IDE ou colega continuar de onde parou.

## Contexto atual

Fase de preparação para a Sprint 1 (Aula 10). Arquitetura e DER definidos na Aula 08; padrões, Git e arquivos para IA definidos na Aula 09. **Backend trocado de Node.js/Express para Supabase direto** (Auth + RLS + funções SQL + Edge Functions — ADR-009). Nenhum código escrito ainda.

## Progresso recente

- [x] Arquitetura, stack e DER documentados (Aula 08 — 17/09)
- [x] AGENTS.md, SPEC.md, TASKS.md, MEMORY.md, ADRs e docs complementares criados (Aula 09 — 24/09)
- [x] Documentação revisada para backend no Supabase, sem Node.js/Express (ADR-009 — 24/09)
- [ ] T01 — Criar repositório e branches
- [ ] T02 — Estrutura inicial e documentação

## Próximos passos

1. Executar T01 e T02 (repositório + estrutura).
2. Em paralelo: T03 (projeto Supabase + CLI) e T04 (app).
3. Schema inicial com RLS (T06), dados iniciais (T07) e configuração do Auth (T08).

## Decisões a confirmar com o squad

- [ ] **Domínio institucional:** confirmar se o e-mail dos alunos é `@ulbra.br` (se for outro, só muda o registro em INSTITUICAO).
- [ ] **`n_ocupantes` do rateio:** o motorista entra na divisão? Proposta: `n_ocupantes = vagas oferecidas + 1` (motorista incluso), fixado na publicação — assim o valor por passageiro não muda conforme outros reservam.
- [ ] **Prazo de expiração da reserva PENDENTE:** proposta de 15 minutos.
- [ ] **Percentual da taxa da plataforma:** definir valor inicial em PARAMETRO_CUSTO.
- [ ] **Reembolso em cancelamento:** no MVP (sandbox), apenas registrar status; definir regra para produção.
- [ ] **Estratégia de branches:** usar `develop` (recomendado) ou só `main` + features.
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

- **24/09/2026** — Decisão: backend direto no Supabase, sem Node.js/Express/Render/Prisma (ADR-009). Docs e backlog revisados (T01–T31).
- **24/09/2026** — Aula 09: criados os arquivos de contexto para IA e o backlog técnico (T01–T34).
- **17/09/2026** — Aula 08: arquitetura, stack, DER e UML (Casos de Uso + Sequência UC05).
