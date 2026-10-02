# MEMORY.md — Diário de Bordo

> Atualize ao final de **cada sessão de trabalho** (humana ou com IA). Mais recente no topo do "Histórico".
> Serve para qualquer agente, IDE ou colega continuar de onde parou.

## Contexto atual

Fase de preparação para a Sprint 1 (Aula 10). Arquitetura e DER definidos na Aula 08; padrões, Git e arquivos para IA definidos na Aula 09. **Backend trocado de Node.js/Express para Supabase direto** (Auth + RLS + funções SQL + Edge Functions — ADR-009). Fundação pronta (T01–T04): Supabase local com Edge Function `health` e app Expo em `mobile/`. Fase 1 (modelo de dados): schema inicial com RLS (T06) e ULBRA em migration (T07); projeto remoto `yqovnmlrbpkgwzmlnncb` (São Paulo) linkado, recebe as migrations por `supabase db push` (conferir com `supabase migration list`). Fase 2 (autenticação no backend): padrão de erros das Edge Functions (T05), Auth com confirmação obrigatória e SMTP do Resend no remoto (T08), hook de domínio + trigger de perfil e privilégios padrão (T09). O remoto recebe a config do Auth por `supabase config push` (bloco `[remotes.producao]` do `config.toml`).

## Progresso recente

- [x] Arquitetura, stack e DER documentados (Aula 08 — 17/09)
- [x] AGENTS.md, SPEC.md, TASKS.md, MEMORY.md, ADRs e docs complementares criados (Aula 09 — 24/09)
- [x] Documentação revisada para backend no Supabase, sem Node.js/Express (ADR-009 — 24/09)
- [x] T01 — Criar repositório e branches (01/10)
- [x] T02 — Estrutura inicial e documentação (01/10)
- [x] T03 — Inicializar o Supabase (01/10)
- [x] T04 — Inicializar o app (01/10)
- [x] T06 — Schema inicial com RLS: instituicao, usuario, veiculo, carona + pgTAP (02/10)
- [x] T07 — Dados iniciais: ULBRA em migration idempotente + `seed.sql` de desenvolvimento (02/10)
- [x] T05 — Padrão de erros: `_shared/` com `AppError`, `comTratamentoDeErros`, CORS por lista e `validarCorpo` (Zod 4.6.5) (02/10)
- [x] T08 — Auth: confirmação obrigatória, senha ≥ 8, template pt-BR, `campusshare://`, SMTP do Resend só no remoto (02/10)
- [x] T09 — Hook `validar_dominio_institucional` + trigger `criar_perfil_usuario` + migration `privilegios_padrao` (02/10)

## Próximos passos

1. Fase 3: cliente Supabase no app (T10), telas de cadastro (T11), login (T12) e perfil (T13).
2. Adicionar `"scheme": "campusshare"` ao `mobile/app.json` (T11/T12) — sem ele o link de confirmação não abre o app.

## Decisões a confirmar com o squad

- [x] **Domínio institucional:** confirmado como `@rede.ulbra.br` (Gustavo, 01/10). Docs atualizados; a T07 deve gravar `dominio_email = rede.ulbra.br`.
- [ ] **`n_ocupantes` do rateio:** o motorista entra na divisão? Proposta: `n_ocupantes = vagas oferecidas + 1` (motorista incluso), fixado na publicação — assim o valor por passageiro não muda conforme outros reservam.
- [ ] **Prazo de expiração da reserva PENDENTE:** proposta de 15 minutos.
- [x] **Parâmetros de custo iniciais** (Gustavo, 02/10): `percentual_taxa = 0.1000` (10%) e `preco_litro = 6.29`. Entram na migration idempotente de PARAMETRO_CUSTO da T20.
- [ ] **Reembolso em cancelamento:** no MVP (sandbox), apenas registrar status; definir regra para produção.
- [x] **Estratégia de branches:** `develop` + `feature/T<ID>-...` (adotada na T01, 01/10). `main` e `develop` protegidas: merge só por PR, **0 aprovações** (decisão do Gustavo, que valida e faz o merge sozinho), sem force-push e sem deleção.
- [x] **Alterações de USUARIO no DER** aprovadas em 02/10: `id_usuario` FK para `auth.users`, sem `senha_hash`/`email_verificado`, com `expo_push_token` (ver `docs/DATABASE.md`). Falta redesenhar o DER da Aula 08. As alterações de RESERVA e PAGAMENTO seguem pendentes.
- [x] **Destino do link de confirmação de e-mail:** deep link do app, `site_url = campusshare://` (e `exp://**` em desenvolvimento) — Fase 2, 02/10. Falta o app tratar o link (T11/T12).

## Notas para o próximo agente

- Leia `AGENTS.md` antes de tudo; regras de negócio estão em `SPEC.md` (RN01–RN19).
- Segredos ficam no `.env` (modelo em `.env.example`). Nunca versionar chaves.
- Não existe servidor Node.js/Express nem Render: o backend é o projeto Supabase (ADR-009). Tudo que muda o banco vai em `supabase/migrations`.
- Desenvolvimento local exige Docker (`supabase start`). E-mails do Auth local aparecem no Mailpit (`localhost:54324`); o SMTP do Resend só é ligado no remoto (`[remotes.producao]` no `config.toml`, senha em `supabase/.env`).
- Mudou `config.toml`? Local: `supabase stop && supabase start`. Remoto: `supabase config diff` e depois `supabase config push`.
- Migrations novas: objetos nascem **sem** privilégio para `anon`/`authenticated` (migration `privilegios_padrao`); conceda o mínimo com `grant` explícito e teste o acesso.
- Resend sem domínio próprio: o remetente `onboarding@resend.dev` só entrega para o e-mail dono da conta do Resend.
- `seed.sql` só roda localmente; dados essenciais (ULBRA, PARAMETRO_CUSTO) vão em migration.
- O projeto free do Supabase pausa após ~7 dias sem uso: reativar pelo painel antes da demo.

## Histórico

- **02/10/2026** — Fase 2 (T05, T08, T09): `_shared/` das Edge Functions (erros, CORS, Zod) aplicado na `health`; Auth com confirmação obrigatória, senha ≥ 8, link de 24 h, template pt-BR e SMTP do Resend no remoto via `[remotes.producao]`; migration `privilegios_padrao` (inclui revoke global de `EXECUTE` para `PUBLIC` em funções do `postgres`); hook `validar_dominio_institucional` (422 `DOMINIO_INVALIDO`) e trigger `criar_perfil_usuario`; testes 01/02 e `seed.sql` passam a criar o perfil pelo trigger. 112 testes pgTAP, 11 `deno test`.
- **02/10/2026** — Fase 1 (T06, T07): migration `schema_inicial` (enums, 4 tabelas, CHECKs, FK composta carona → veículo do mesmo motorista, RLS com `(select auth.uid())`, grants explícitos sem nada para `anon`); pgTAP de estrutura, CHECKs e RLS; ULBRA (`rede.ulbra.br`) em migration idempotente; `seed.sql` com 2 usuários, 1 veículo e 1 carona. Ajustes da Fase 0: domínio nos docs restantes, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `deno.lock`. Decididos `percentual_taxa = 0.1000` e `preco_litro = 6.29` para a T20.
- **01/10/2026** — T01 a T04 (Fase 0): `develop` criada e protegida (PR obrigatório, 0 aprovações, por decisão do Gustavo); estrutura `supabase/` + `mobile/` e `.gitignore`; `supabase init` com Edge Function `health` (handler + teste `deno test`); app Expo SDK 57 (TypeScript strict, ESLint + Prettier) com tela "CampusShare". Domínio institucional confirmado: `rede.ulbra.br`.
- **24/09/2026** — Decisão: backend direto no Supabase, sem Node.js/Express/Render/Prisma (ADR-009). Docs e backlog revisados (T01–T31).
- **24/09/2026** — Aula 09: criados os arquivos de contexto para IA e o backlog técnico (T01–T34).
- **17/09/2026** — Aula 08: arquitetura, stack, DER e UML (Casos de Uso + Sequência UC05).
