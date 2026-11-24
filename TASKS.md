# TASKS.md — CampusShare

Backlog técnico derivado das user stories (AP1) e do planejamento da Aula 08, revisado em 24/09 para backend direto no Supabase (ADR-009).
Cada tarefa = **1 branch** (`feature/T06-schema-inicial`) = **1 Pull Request**.

**Status:** `a fazer` · `em andamento` · `feito` · `adiada (pós-AP2)`
**Responsável:** preencher ao pegar a tarefa.

---

## Foco até a AP2 (16/10 → 22/10)

Decisão do Gustavo em 16/10: até a demo da AP2 (22/10) só entram as tarefas abaixo. As demais ficam `adiada (pós-AP2)` e voltam depois da demo, para completar o app.

**Demo AP2 (ordem sugerida):**

| Dia | Trilha A — caronas | Trilha B — reserva e pagamento | Geral |
|---|---|---|---|
| 16–17/10 | T15 (veículos: trigger `VEICULO_EM_USO`) — feito | T20 (tabelas RESERVA, PAGAMENTO, PARAMETRO_CUSTO) — feito | T14 (deploy + CI) |
| 17–18/10 | T16 (tela de veículos) · T17 (publicar carona) — feitas | T21 (reserva com rateio) | |
| 18–19/10 | T18 (buscar caronas) — feita | T22 (reserva + Pix sandbox) — **precisa das credenciais de teste do Mercado Pago** | |
| 19–20/10 | T19 (telas de publicar e buscar) — feita | T23 (webhook de pagamento) | |
| 20–21/10 | | T25 (telas de reserva e pagamento) — feita | |
| 18–21/10 | | | T32 (identidade visual) — feita (telas da demo; demais na Fase 16) |
| 21–22/10 | | | T31 (build e roteiro da demo) — feita |

As duas trilhas só se encontram na T21, que depende da T18. Cada tarefa continua sendo uma branch e um PR, com teste manual antes do merge.

**Fluxo da demo:** cadastro com e-mail institucional → veículo → publicar carona → buscar carona → reservar com rateio → pagar com Pix sandbox → reserva confirmada.

**Adiadas para depois da AP2:** T24 (expiração de reservas), T26 (sugestão de preço e teto), T27 (mapa), T28 (cancelamentos), T29 (notificações), T30 (avaliações e `perfil_publico`) e o PKCE no deep link de confirmação (ver MEMORY.md).

---

## Sprint 1 — Setup, cadastro e login (Aula 10)

### T01 — Criar repositório e branches
Status: feito · Responsável: Gustavo Trespach
Descrição: Criar repositório no GitHub com `main` e `develop`; proteger as duas (merge só via PR com 1 aprovação).
Aceite: repositório existe; push direto na `main`/`develop` é bloqueado.

### T02 — Estrutura inicial e documentação
Status: feito · Responsável: Gustavo Trespach · Depende de: T01
Descrição: Criar pastas `supabase/`, `mobile/`, `docs/` e versionar AGENTS.md, README.md, SPEC.md, TASKS.md, MEMORY.md e `docs/*`. Adicionar `.gitignore` (node_modules, .env, `supabase/.temp`, `supabase/functions/.env`, builds).
Aceite: estrutura igual à do AGENTS.md na `develop`.

### T03 — Inicializar o Supabase
Status: feito · Responsável: Gustavo Trespach · Depende de: T02
Descrição: Criar o projeto no Supabase; `supabase init` e `supabase link`; `deno.json` em `supabase/functions` com fmt/lint; Edge Function `health` (`verify_jwt = false`).
Aceite: `supabase start` sobe o ambiente local; `GET /functions/v1/health` retorna `{ "status": "ok" }`; `deno lint` e `deno fmt --check` passam.

### T04 — Inicializar o app
Status: feito · Responsável: Gustavo Trespach · Depende de: T02
Descrição: Projeto Expo (TypeScript, Expo Router) em `mobile/`, com ESLint e Prettier, e tela inicial provisória.
Aceite: app abre no Expo Go em Android e iOS.

### T05 — Padrão de erros e validação
Status: feito · Responsável: Gustavo Trespach · Depende de: T03
Descrição: `supabase/functions/_shared/` com `AppError`, handler de erro `{ error: { code, message, details } }`, CORS e helper Zod; convenção de `raise exception` nas funções SQL (ver `docs/API.md`).
Aceite: payload inválido numa Edge Function → 400 com os campos inválidos; erro não tratado → 500 genérico; teste com `deno test`.

### T06 — Schema inicial com RLS
Status: feito · Responsável: Gustavo Trespach · Depende de: T03
Descrição: Migration com INSTITUICAO, USUARIO (FK para `auth.users`), VEICULO e CARONA, enums e constraints conforme `docs/DATABASE.md`; RLS habilitada e políticas das 4 tabelas.
Aceite: `supabase db reset` cria as tabelas com PK, FK, UNIQUE, CHECK e enums; testes pgTAP provam que um usuário não lê o perfil nem os veículos de outro.

### T07 — Dados iniciais
Status: feito · Responsável: Gustavo Trespach · Depende de: T06
Descrição: Migration idempotente com a INSTITUICAO ULBRA (`dominio_email = rede.ulbra.br`); `seed.sql` com dados de desenvolvimento.
Aceite: rodar `supabase db reset` duas vezes não duplica; a ULBRA existe também no projeto remoto após `db push`.

### T08 — Configurar o Supabase Auth
Status: feito · Responsável: Gustavo Trespach · Depende de: T03
Descrição: Confirmação de e-mail obrigatória, senha mínima de 8, SMTP do Resend, template do e-mail em pt-BR, URL de redirecionamento (deep link do app) e rate limits — no painel e no `config.toml`.
Aceite: e-mail de confirmação chega via Resend com link válido; usuário não confirmado não consegue login.

### T09 — Validação de domínio e perfil no cadastro (US02)
Status: feito · Responsável: Gustavo Trespach · Depende de: T06, T07, T08
Descrição: Auth Hook Before User Created `validar_dominio_institucional` (recusa domínio fora de INSTITUICAO) e trigger `criar_perfil_usuario` (cria USUARIO a partir de `raw_user_meta_data`).
Aceite: e-mail `@rede.ulbra.br` cria usuário + perfil; outro domínio → erro `DOMINIO_INVALIDO`; e-mail duplicado → erro do Auth; testes pgTAP cobrindo os casos.

### T10 — Cliente Supabase no app
Status: feito · Responsável: Gustavo Trespach · Depende de: T04, T05
Descrição: `@supabase/supabase-js` em `mobile/src/services/` com URL e publishable key do `.env`, sessão persistida em armazenamento seguro (`expo-secure-store`), normalização de erros em `AppError` e tipos gerados (`supabase gen types`).
Aceite: app chama a Edge Function `health` e exibe o status.

### T11 — Tela de cadastro (US02)
Status: feito · Responsável: Gustavo Trespach · Depende de: T09, T10
Descrição: Formulário com nome, e-mail institucional, senha, gênero e telefone (`auth.signUp` com metadata); aviso "confira seu e-mail" e botão de reenvio (`auth.resend`).
Aceite: erros do backend aparecem no campo certo; validação local de formato antes de enviar.

### T12 — Tela de login e sessão (US01)
Status: feito · Responsável: Gustavo Trespach · Depende de: T08, T10
Descrição: Login com `auth.signInWithPassword`; rotas protegidas redirecionam para o login; botão de sair.
Aceite: login leva à Home; e-mail não confirmado mostra mensagem clara; senha errada mostra erro genérico; ao reabrir o app continua logado; logout limpa a sessão.

### T13 — Perfil do usuário
Status: feito · Responsável: Gustavo Trespach · Depende de: T09, T10
Descrição: Tela de perfil lendo/atualizando a tabela `usuario` (só colunas liberadas). A view `perfil_publico` foi movida para a T30 (depende de AVALIACAO).
Aceite: usuário edita nome, telefone e gênero; não consegue alterar e-mail nem instituição; testes de RLS passam.

### T14 — Deploy do backend
Status: feito · Responsável: Gustavo Trespach · Depende de: T09
Descrição: GitHub Actions na `main` rodando `supabase db push` e `supabase functions deploy`; segredos com `supabase secrets set`.
Aceite: `health` responde no projeto remoto; cadastro e login funcionam com o app apontando para o projeto.
Nota (16/10): workflows `CI` (todo PR: `banco`, `edge-functions`, `app`) e `Deploy` (push na `main`) em `.github/workflows/`. Primeiro deploy pela release #18 (`health` HTTP 200); app testado no Expo Go contra o remoto (login, perfil, bloqueio de `@gmail.com`). `config push` e `secrets set` continuam manuais (`docs/architecture.md`).

---

## Sprint 2 — Veículos, caronas, reservas e pagamento

### T15 — Regras de veículos
Status: feito · Responsável: Gustavo Trespach · Depende de: T06
Descrição: Políticas RLS de CRUD dos próprios veículos, CHECK de placa (antigo e Mercosul) e trigger que impede excluir veículo com carona ABERTA (`VEICULO_EM_USO`).
Aceite: usuário só vê e altera os próprios veículos (pgTAP); placa inválida é recusada.
Nota (16/10): a RLS de `veiculo` e o CHECK de placa já entraram na T06 (`schema_inicial`). A T15 adicionou a migration `regras_veiculos` (trigger `impedir_exclusao_veiculo_em_uso`: `VEICULO_EM_USO` com carona ABERTA/LOTADA, `VEICULO_COM_HISTORICO` só com histórico) e o pgTAP `06_veiculos`.

### T16 — Tela de veículos
Status: feito · Responsável: Gustavo Trespach · Depende de: T15, T10
Descrição: `consumo_kml` sugerido pela motorização, editável.
Aceite: cadastrar, listar, editar e excluir veículo pelo app.
Nota (16/10): telas `(autenticado)/veiculos/` com service `veiculos.ts`; roteiro de teste aprovado pelo Gustavo no iPhone (Expo Go) contra o Supabase local.

### T17 — Publicar carona (US03, US07)
Status: feito · Responsável: Gustavo Trespach · Depende de: T15
Descrição: Função SQL `publicar_carona` (RPC) com veículo, origem/destino (texto + lat/lng), data/hora, vagas, `custo_total` digitado, `tolerancia_min` e `somente_mulheres`; `id_motorista = auth.uid()`.
Aceite: RN04, RN05 e RN06 validadas na função; INSERT direto em `carona` pelo app é bloqueado; carona nasce `ABERTA`.
Nota (16/10): a T20 criou `carona.vagas_ofertadas` (obrigatória, 1 a 7); `publicar_carona` grava `vagas_ofertadas` e `vagas_disponiveis` com o mesmo valor. Feita na migration `publicar_carona` (pgTAP `08_publicar_carona`); erros e assinatura em `docs/API.md`.

### T18 — Buscar caronas (US05)
Status: feito · Responsável: Gustavo Trespach · Depende de: T17
Descrição: Funções `buscar_caronas(p_lat, p_lng, p_raio_km, p_somente_mulheres, p_data, p_pagina)` — bounding box + haversine, ordenado por proximidade e horário — e `detalhar_carona`.
Aceite: só caronas `ABERTA` e futuras (RN08); filtro "somente mulheres" funciona; telefone do motorista não aparece.
Nota (17/10): migration `buscar_caronas` com `buscar_caronas`, `detalhar_carona` e `valor_por_passageiro` (fórmula única do rateio, reaproveitada pela T21); pgTAP `09_buscar_caronas`. O `seed.sql` ganhou caronas variadas para a T19.

### T19 — Telas de publicar e buscar carona
Status: feito · Responsável: Gustavo Trespach · Depende de: T17, T18
Aceite: motorista publica pelo app; Home lista caronas próximas com horário, vagas, valor e tolerância.
Nota (16/10): o mapa (T27) e a Directions API (T26) ficaram para depois da AP2. Para a demo, origem e destino precisam de latitude/longitude sem mapa (por exemplo, localização atual do aparelho com `expo-location` e uma lista curta de pontos fixos, como o campus). Definir no prompt da tarefa.
Nota (17/10): Home "Caronas próximas", `caronas/publicar` e `caronas/[id]` com pontos fixos e localização atual (PR #27); roteiro de 20 passos aprovado pelo Gustavo no iPhone (Expo Go) contra o Supabase local.

### T20 — Tabelas RESERVA, PAGAMENTO e PARAMETRO_CUSTO
Status: feito · Responsável: Gustavo Trespach · Depende de: T06
Descrição: Migration das tabelas com RLS (leitura pelos participantes, sem escrita direta) e PARAMETRO_CUSTO inicial em migration idempotente.
Aceite: migration aplicada, testes de RLS passando e `docs/DATABASE.md` conferido.
Nota (16/10): migration `reserva_pagamento` com as 3 tabelas, enums `status_reserva`, `status_pagamento` e `metodo_pagamento`, `carona.vagas_ofertadas` (RN11), RLS só de leitura e `parametro_custo` inicial (6.29 / 0.1000); pgTAP `07_reserva_pagamento`.

### T21 — Função de reserva com rateio (US04)
Status: feito · Responsável: Gustavo Trespach · Depende de: T18, T20
Descrição: Função SQL `reservar_vaga(p_id_carona, p_id_passageiro)` — `SELECT ... FOR UPDATE`, calcula `valor_individual` (RN11, por `valor_por_passageiro`), valida RN08, RN14 e RN18, cria reserva `PENDENTE` **e o pagamento `PENDENTE` com taxa e repasse (RN13)**, decrementa vagas e marca `LOTADA` com 0 vagas; executável só pela `service_role`.
Aceite: teste de concorrência — duas chamadas simultâneas na última vaga, só uma passa; RN14 e RN18 cobertas em pgTAP.
Nota (16/10): `n_ocupantes = vagas oferecidas + 1` (motorista incluso), fixado na publicação — decisão do Gustavo registrada na RN11 do `SPEC.md`. Use `carona.vagas_ofertadas` (T20), não `vagas_disponiveis`, que diminui a cada reserva.
Nota (17/10): feita na migration `reservar_vaga`; pgTAP `10_reservar_vaga` e teste de concorrência `supabase/tests/concorrencia/ultima_vaga.sh` (roda no job `banco` do CI).

### T22 — Edge Function de reserva + cobrança Pix sandbox (US04)
Status: feito · Responsável: Gustavo Trespach · Depende de: T21
Descrição: `reservar-vaga`: valida o JWT, chama `reservar_vaga` (que já cria a reserva e o PAGAMENTO `PENDENTE` com taxa e repasse — RN13, desde a T21), gera a cobrança no Mercado Pago (sandbox) e grava o `id_externo` da cobrança no pagamento por uma função SQL só da `service_role`. Se a cobrança falhar, desfaz a reserva e devolve a vaga por outra função SQL (transação com `FOR UPDATE` na carona), para a vaga não ficar presa.
Aceite: resposta traz QR code / copia-e-cola do Pix; falha simulada do MP não deixa vaga presa (`deno test`).
Nota (16/10): antes de começar, o Gustavo cria a conta de desenvolvedor do Mercado Pago e as credenciais de **teste** (sandbox), cadastradas com `supabase secrets set`, nunca no repositório.
Nota (17/10): feita com a API de **Orders** (Checkout Transparente, Pix): Edge Function `reservar-vaga` (`verify_jwt = true`, fetch direto, sem SDK) e migration `cobranca_pix` (`registrar_cobranca`, `desfazer_reserva_sem_cobranca`); `deno test` e pgTAP `11_cobranca_pix`. Na release, o Gustavo cadastra `MERCADO_PAGO_ACCESS_TOKEN` (teste) com `supabase secrets set`.

### T23 — Webhook de pagamento
Status: feito · Responsável: Gustavo Trespach · Depende de: T22
Descrição: Edge Function `webhook-mercado-pago` (`verify_jwt = false`) valida a assinatura, consulta a order no MP e chama `confirmar_pagamento`: PAGAMENTO `APROVADO` e RESERVA `CONFIRMADA`; Pix pago de reserva desfeita vira `REEMBOLSO_PENDENTE`. As vagas não mudam aqui (a vaga é ocupada e a carona fica `LOTADA` na `reservar_vaga`, T21).
Aceite: idempotente (webhook repetido não duplica efeito); assinatura inválida → 401.
Nota (16/10): o Mercado Pago só alcança o webhook no projeto remoto, então o teste ponta a ponta depende da T14.
Nota (17/10, T22): no sandbox, a order com pagador `APRO` termina em `processed/accredited` (não `approved`) cerca de 3 minutos depois de criada; `external_reference` = `id_pagamento` e `pagamento.id_externo` = id da order (`ORDTST…`). O webhook deve consultar a order pela API e tratar `processed/accredited` como pago.
Nota (17/10, T23): feita (migration `confirmar_pagamento`, pgTAP `12_confirmar_pagamento`, `deno test`); verificada no local com notificações assinadas de verdade. O teste com o Mercado Pago chamando o webhook depende da release (secrets e URL no painel).

### T24 — Expiração de reservas pendentes
Status: feito · Responsável: Gustavo Trespach · Depende de: T21
Descrição: Função `expirar_reservas()` agendada no pg_cron a cada minuto: marca `EXPIRADA` a reserva `PENDENTE` vencida (15 minutos desde `reserva.criado_em`, decisão do Gustavo em 21/11) e devolve a vaga (RN16).
Aceite: reserva não paga após o prazo libera a vaga automaticamente (pgTAP chamando a função com reserva antiga).
Nota (21/11, Parte A): PR #63. Migration `20261121154122_expirar_reservas`: `pg_cron` em `pg_catalog`, `prazo_reserva_pendente()` (15 min), `expirar_reservas()` (`SECURITY DEFINER`, só job e `service_role`; trava carona → reserva → pagamento e confere de novo), índice parcial das `PENDENTE` e job `expirar-reservas` (`* * * * *`, upsert pelo nome). pgTAP `14_expirar_reservas` (31 testes, 413 no total). A `confirmar_pagamento` já trata Pix pago depois da expiração (`REEMBOLSO_PENDENTE`, sem mexer na vaga). O prazo do QR no Mercado Pago ficou pendente (documentação não fecha os limites para Pix).
Nota (23/11, Parte B): release #64; o workflow Deploy aplicou a `20261121154122` no remoto (`db push` sem erro no pg_cron) e a `health` respondeu 200; o `migration list` do Manter ativo mostra local = remoto até a `20261121154122`. Edge Functions sem mudança de código (o CLI reimplantou a `reservar-vaga` com o mesmo código-fonte; `health` 200, `reservar-vaga` e `webhook-mercado-pago` 401 sem credenciais, como antes).

### T25 — Telas de reserva e pagamento
Status: feito · Responsável: Gustavo Trespach · Depende de: T22, T23
Descrição: Botão "Reservar vaga" no detalhe da carona (com confirmação do valor); tela de pagamento com o QR e o copia e cola do Pix e o status atualizado por **polling** a cada 5 s enquanto a tela está aberta (para ao confirmar, ao sair e após 15 min); tela "Minhas reservas" (função `minhas_reservas`).
Decisão (revisor + Gustavo, 17/10): polling em vez de Realtime até a AP2: não muda o banco, funciona no Expo Go e cumpre o aceite ("sem recarregar a tela"). O Realtime fica para depois da AP2.
Aceite: passageiro vê valor, paga pelo Pix sandbox e vê a reserva confirmada sem recarregar a tela.

---

## Sprint 3 — Sugestão de preço, notificações e avaliações

### T26 — Distância, sugestão de preço e teto (RN09, RN10)
Status: adiada (pós-AP2) · Depende de: T17
Descrição: Edge Function `sugestao-preco` (Directions API) retorna `distancia_km` e `custo_estimado`; Edge Function `publicar-carona` recalcula o custo no servidor, aplica o teto e chama `publicar_carona`, que passa a ser executável só pela `service_role`.
Aceite: `custo_total > custo_estimado` → 422 `PRECO_ACIMA_DO_TETO`; fallback sem sugestão (e sem teto) se a Directions API falhar.

### T27 — Mapa na publicação e no detalhe
Status: adiada (pós-AP2) · Depende de: T26
Aceite: motorista escolhe origem/destino no mapa; detalhe mostra a rota.

### T28 — Cancelar carona e reserva (US06)
Status: feito · Responsável: Gustavo Trespach · Depende de: T23
Partes: **backend** (funções `cancelar_reserva` e `cancelar_carona`, Fase 29, branch `feature/T28-cancelamentos-backend`) e **app** (botões de cancelar e a tela "Minhas caronas", Fase 30, em outra branch).
Regra (Gustavo, 23/11): o passageiro cancela reserva `CONFIRMADA` até 2 horas antes da partida e reserva `PENDENTE` até a partida (RN20); o motorista cancela a carona até a partida, sem o limite de 2 h (RN07).
Descrição: Funções RPC `cancelar_carona` e `cancelar_reserva`, devolvendo vagas na mesma transação; pagamentos aprovados passam a `REEMBOLSO_PENDENTE`.
Aceite: cancelamento da carona cancela todas as reservas ativas; só o dono cancela.
Nota (23/11, parte backend): PR #66. `cancelar_reserva` (RN20) e `cancelar_carona` (RN07), `SECURITY DEFINER` só para `authenticated`, locks carona → reservas → pagamentos; pgTAP `15_cancelamentos` (55 testes).
Nota (23/11, parte app): services `cancelarReserva`, `cancelarCarona` e `listarMinhasCaronas`; botão "Cancelar reserva" no detalhe da reserva e "Cancelar carona" no detalhe da carona (motorista), com confirmação, resultado anunciado ao leitor de tela e o `hint` do backend no erro; tela nova "Minhas caronas" com atalho no Perfil; selos dos status de carona. O app não calcula o prazo de 2 h. 33 testes novos (367 no total). Falta conferir no aparelho, merge, release e EAS Update.
Nota (24/11, Parte B): release #68 (Deploy aplicou a `20261123225328_cancelamentos`; `cancelar_reserva` e `cancelar_carona` respondem 401 `42501` sem sessão no remoto). Testada pelo Gustavo no iPhone contra o remoto (testes 1 a 6 passaram; pagamentos conferidos no painel). EAS Update único da `main` (`2bc2040`) com runtime 1.1.0, grupo `57d1e8e7-f9a2-4173-bc48-1f9523c95275` ("T28 e T41: cancelamentos e listas legíveis"); runtime 1.0.0 continua com o update de 18/10.

### T29 — Notificações (US06)
Status: adiada (pós-AP2) · Depende de: T28
Descrição: Tabela NOTIFICACAO com RLS; coluna `expo_push_token` em USUARIO; triggers que gravam notificação ao reservar, confirmar e cancelar; Database Webhook no INSERT → Edge Function `enviar-push` (Expo Push API); tela de notificações com "marcar como lida".
Aceite: passageiros recebem push no cancelamento; motorista recebe push em nova reserva.

### T30 — Concluir carona e avaliações
Status: em andamento · Responsável: Gustavo Trespach · Depende de: T23
Partes: **backend** (Fase 33, branch `feature/T30-concluir-avaliar-backend`) e **app** (Fase 34, em outra branch).
Regras (Gustavo, 24/11): o motorista conclui a carona da partida até 1 dia depois; sem conclusão nesse prazo, o sistema conclui sozinho (job de hora em hora); avaliação até 7 dias depois da partida, entre o motorista e cada passageiro com reserva `CONFIRMADA`.
Descrição: Função `concluir_carona`; job `concluir-caronas`; tabela AVALIACAO com RLS; função `avaliar_participante` (RN19); `avaliacoes_pendentes`; perfil público (nome + média, sem e-mail, telefone ou gênero — movido da T13 em 16/10) como função `perfil_publico`; reputação do motorista no `detalhar_carona`.
Aceite: só participantes avaliam, uma vez cada, após a conclusão.
Nota (24/11, parte backend): migration `20261124011419_concluir_avaliar` com `prazo_conclusao_carona()` (1 dia), `prazo_avaliacao()` (7 dias), `concluir_carona`, `concluir_caronas_vencidas` + job `concluir-caronas` (`0 * * * *`), tabela `avaliacao` (RLS: o avaliador lê as próprias; escrita só pela função), `avaliar_participante`, `avaliacoes_pendentes`, `perfil_publico` e `detalhar_carona` com `media_motorista`/`total_avaliacoes_motorista`. pgTAP `16_concluir_avaliar` (69 testes, 537 no total). Falta a parte app (Fase 34), merge e release.
Nota (24/11, parte app): services `concluirCarona`, `avaliarParticipante`, `listarAvaliacoesPendentes` e `obterPerfilPublico` (média `number | null`); "Concluir carona" no detalhe da carona (motorista, carona que já partiu) e a reputação do motorista no card; telas novas "Avaliações pendentes" e "Avaliar" (componente `SeletorNota`); aviso de pendências no Início; atalho e a própria média no Perfil. O app não calcula prazo: mostra o `hint` do backend. 41 testes novos (432 no total). Falta conferir no aparelho, merge, release e EAS Update.

### T32 — Identidade visual (tema, componentes, telas da demo, ícone e splash)
Status: feito · Responsável: Gustavo Trespach · Depende de: T25
Descrição: Aplicar a especificação de `docs/design/DESIGN.md`: `mobile/src/tema.ts`, componentes base (Botao, CampoTexto, Aviso, SeloStatus, EstadoVazio, LinhaRota, Avatar), header padrão, telas da demo (1 Entrar, 5 Caronas próximas, 6 Detalhes da carona, 8 Pagamento, 9 Minhas reservas), ícone e splash. As demais telas ficam para a Fase 16. Só apresentação: nenhuma regra de negócio muda.
Aceite: as telas 1, 5, 6, 8 e 9 seguem os mockups de `docs/design/mockups/`, nenhuma tela perde funcionalidade, nenhuma cor escrita à mão nas telas tocadas e `app.json` com o ícone, o ícone adaptativo e o splash.

### T31 — Build de demonstração (AP2)
Status: feito · Responsável: Gustavo Trespach · Depende de: T19, T25 (até 16/10: T25, T29)
Descrição: Projeto EAS `@trespaco/campusshare`; APK Android pelo EAS Build (perfil `preview`); iPhone pelo Expo Go abrindo o EAS Update do canal `preview` (sem conta Apple Developer não há build iOS); app apontando para o Supabase remoto pelas variáveis do ambiente `preview` do EAS; roteiro em `docs/DEMO.md`.
Nota (18/10): confirmado pelo Gustavo no iPhone: o update abriu no Expo Go, login no remoto, "Servidor: ok" e reserva confirmada pelo webhook. Falta testar o APK num Android.
Aceite: app instalado em pelo menos 2 celulares reais, fluxo completo cadastro → carona → reserva → pagamento sandbox funcionando.
Nota (16/10): o projeto EAS será criado com o nome `campusshare` só nesta tarefa. Build de iOS instalável em aparelho exige conta paga do Apple Developer Program, fora do orçamento zero; para a demo, decidido (16/10): APK no Android e Expo Go no iPhone.

### T33 — Deploy público (TD de deploy)
Status: feito · Responsável: Gustavo Trespach · Depende de: T31
Descrição: APK de produção pelo EAS Build anexado à release `v1.0.0` do GitHub (link permanente; o artefato do EAS expira), backend Supabase reativado e conferido (`health`, Edge Functions e segredos), workflow `manter-ativo.yml` para o plano gratuito não pausar o projeto, varredura de segredos no histórico e `docs/DEPLOY.md` com links, variáveis e checklist.
Aceite: APK baixado e instalado por link público em aba anônima, fora da máquina de quem publicou; nenhum segredo no repositório.
Nota (12/11): release `v1.0.0` com o APK publicada; APK instalado num Android de outra pessoa com login no remoto. O Expo Go do iPhone passou para o SDK 58 e não abre mais o app (SDK 57): migrar o SDK é a próxima tarefa.

### T34 — Migrar para o Expo SDK 58
Status: feito · Responsável: Gustavo Trespach · Depende de: T33
Descrição: Atualizar o app (`mobile/`) do Expo SDK 57 para o 58, porque o Expo Go da App Store passou para o SDK 58 e o iPhone só roda o app pelo Expo Go. A versão do app passa para `1.1.0`: com `runtimeVersion` pela policy `appVersion`, o runtime novo isola os updates do SDK 58, e o APK `1.0.0` da release `v1.0.0` continua recebendo só o update antigo.
Aceite: app abre no Expo Go SDK 58 do iPhone com login, "Caronas próximas", detalhe e reserva com Pix; APK 1.0.0 intacto; APK 1.1.0 publicado.
Nota (12/11, Parte A): código no SDK 58 (expo 58.0.25, React Native 0.88.1, React 19.3), `expo-doctor` 20/20, lint, typecheck e 284 testes verdes; `version` 1.1.0 e `versionCode` 2; `expo-font` adicionado (peer obrigatória do `@expo/vector-icons`); `@supabase/supabase-js` fixo em 2.118.0. Teste no iPhone pelo `npx expo start` (`.env` no remoto), confirmado pelo Gustavo: com a segunda conta, login, cadastro de veículo e publicação de carona; "Sair"; com a conta dele, login, "Caronas próximas", detalhe, "Reservar vaga", confirmação do valor, tela do Pix com QR e "Copiar código Pix"; pagamento confirmado pelo webhook (com atraso, normal no sandbox do Mercado Pago). Nada publicado na Expo: update e APK 1.1.0 ficam para a Parte B, depois do merge.
Nota (12/11, Parte B): EAS Update publicado da `main` com runtime 1.1.0 (grupo `5037009b-8cd2-46bd-ac9a-68c8f88ea4c9`); o runtime 1.0.0 continua com o update de 18/10 (SDK 57). Testado pelo Gustavo no iPhone pelo link público (Expo Go SDK 58, sem o Mac): abriu, login e "Caronas próximas" ok. APK 1.1.0 (versionCode 2, mesma keystore, build `af211be1`) anexado à release `v1.1.0` (tag na `main`, `6cb96cf`); release `v1.0.0` intacta; os dois links de APK respondem 200.

### T35 — Correções pós-deploy
Status: feito · Responsável: Gustavo Trespach · Depende de: T34
Descrição: Três pendências pequenas das Fases 13 e 19: (1) `sair()` limpa a sessão do aparelho mesmo sem internet ou com erro do servidor, sem depender do comportamento interno do auth-js, e o `@supabase/supabase-js` volta para a 2.x mais recente; (2) `exps://**` na allowlist de redirect do Auth (Expo Go carregado de servidor HTTPS, como no `npx expo start --tunnel`); (3) comentário de `webhook-mercado-pago/assinatura.ts` corrigido: a causa das falhas de assinatura das notificações reais era o segredo (aplicação do vendedor de teste no sandbox), não o id em minúsculas.
Aceite: logout limpa a sessão local sem internet e com erro do servidor, na versão mais recente do supabase-js 2.x; `exps://**` aceito pelo Auth remoto; comentário do webhook corrigido; testes verdes.
Nota (17/11, Parte A): `sair()` tenta o `signOut()` normal e, se ele falha, usa `signOut({ scope: 'local' })`; `@supabase/supabase-js` ^2.119.0 (instalada 2.119.0) com o teste offline intacto e um teste novo (erro 500 no logout); `exps://**` no `config.toml` (o `config push` é do Gustavo); comentário de `assinatura.ts` corrigido; patches do SDK 58 alinhados (`expo-doctor` 20/20). Lint, typecheck, 285 testes do app e 69 `deno test` verdes.
Nota (17/11, Parte B): `config push` do Gustavo aplicou o Auth no remoto (`exps://**` na allowlist; SMTP e hook iguais ao `config.toml`); a etapa de Storage terminou com 402 (Analytics Buckets/Iceberg, recurso pago, ativado em `[remotes.producao.storage.analytics]`) sem alterar nada. EAS Update publicado da `main` (`2444948`) com runtime 1.1.0, grupo `9733805e-ebe6-41ff-bb63-dbf9f4f67ee0`; o runtime 1.0.0 continua com o update de 18/10 (SDK 57). Teste no iPhone (Expo Go SDK 58, link público): "Sair" com e sem internet apaga a sessão, e ao reabrir pelo link o app abre no login, então o aceite do logout está cumprido.
Bug encontrado (17/11): depois do "Sair", com e sem internet, aparece a tela "Unmatched Route — Page could not be found" em vez do login. A sessão é apagada mesmo assim. Correção na T37.

### T36 — Migrar o backend para um projeto Supabase novo
Status: feito · Responsável: Gustavo Trespach · Depende de: T35
Descrição: O projeto atual (`yqovnmlrbpkgwzmlnncb`, org "Trespaco") está numa conta do Supabase cujo painel o Gustavo não acessa (o suporte do plano gratuito não respondeu); só o CLI da máquina dele chega nela. O backend vai para o projeto novo `cofhvybajjzczrbojttv` (São Paulo), na conta dele com login pelo GitHub. Não há dados reais: tudo sai do repositório (12 migrations, 3 Edge Functions, `config.toml`). O projeto antigo não é apagado nem alterado e pausa sozinho; o APK `v1.0.0` continua apontando para ele, e a versão válida passa a ser a `v1.1.0`.
Aceite: projeto novo com as 12 migrations, as 3 Edge Functions ativas, Auth (hook de domínio, SMTP do Resend, redirects com `exps://**`) e segredos do Mercado Pago configurados; app (Expo Go e APK 1.1.0) usando o projeto novo; fluxo completo cadastro/login → carona → reserva → Pix → confirmação pelo webhook funcionando.
Nota (17/11, Parte A): `[remotes.producao]` com o ref novo; `storage.analytics` e `storage.vector` declarados desligados no remoto (402 do plano gratuito; no `config push` da CLI 2.119 dá para recusar só o Storage). DEPLOY, SECURITY, DEMO e MEMORY com o ref, a URL do backend e a do webhook novos. Sem mudança de código, schema ou Edge Functions.
Nota (18/11, Parte B): feito pelo Gustavo: Deploy da release #56 verde no projeto novo (12 migrations, 3 Edge Functions, `health` 200; a primeira tentativa falhou por um `\n` no fim do secret `SUPABASE_PROJECT_ID`), `secrets set` do Mercado Pago, `config push` do Auth (`config diff` zerado), URL do webhook trocada (notificação assinada: 200 com a assinatura certa, 401 com a errada), variáveis do EAS `preview` e as 2 contas `@rede.ulbra.br` criadas no painel com Auto Confirm. EAS Update da `main` (`7664eac`) com runtime 1.1.0, grupo `9a0e79e7-753c-4bba-93db-7df6bdeba244`, com só a URL nova no bundle; o runtime 1.0.0 continua com o update de 18/10 (SDK 57). Teste ponta a ponta do Gustavo no iPhone pelo link público, aprovado: login, veículo, publicar carona, "Sair", reservar, Pix e confirmação automática pelo webhook em menos de 2 minutos. Não conferidos: `functions list` e `secrets list` (precisam do token da conta nova, fora da sessão do agente; as 3 funções responderam no projeto novo) e o APK 1.1.0 num Android.

### T37 — Corrigir a navegação após "Sair" (SDK 58)
Status: feito · Responsável: Gustavo Trespach · Depende de: T35
Ordem: feita **antes** da T36 (migração do backend), porque o bug está no APK 1.1.0 e no Expo Go.
Descrição: Depois do "Sair", o app mostrava "Unmatched Route — Page could not be found" em vez do login (achado no teste da T35). Diagnosticar com teste automatizado e corrigir do jeito indicado pela documentação do Expo Router do SDK 58.
Aceite: tocar em "Sair" (com e sem internet) leva à tela de login; abrir o app sem sessão abre no login; entrar leva a "Caronas próximas"; teste automatizado cobre a transição logado → deslogado.
Nota (17/11, Parte A): causa: quando o guard do `Stack.Protected` vira `false`, o Expo Router 58 redireciona para a âncora do navegador ou, sem âncora, para a primeira rota liberada do Stack raiz, que é o grupo `(publico)`. O destino vira `"/(publico)"`, e o grupo não tem `index`, então cai no `+not-found`. Não é regressão da 58.0.32 (o teste falha igual na 58.0.31) nem do `sair()` (um único evento de sessão `null` com internet, sem internet e com erro 500). Correção em `app/_layout.tsx`: `redirectTo="/entrar"` no guard das rotas autenticadas e `redirectTo="/"` no das públicas. Teste novo `tests/navegacao-sessao.test.tsx` (`renderRouter` com os layouts reais de `app/`) falha sem a correção e passa com ela; `@testing-library/react-native` 14 entrou como devDependency (peer do `expo-router/testing-library`). Lint, typecheck, 291 testes e `expo-doctor` 20/20. Teste do Gustavo no iPhone pelo `npx expo start` (`.env` no remoto), tudo passou: "Sair" com Wi-Fi → login; modo avião → "Sair" → login; reabrir deslogado → login. Falta merge, release e EAS Update (Parte B).
Nota (17/11, Parte B): EAS Update publicado da `main` (`7c4f59a`, Deploy verde) com runtime 1.1.0, grupo `b9a904a8-3a58-453d-8ebb-f03b6fffb650`; o runtime 1.0.0 continua com o update de 18/10 (SDK 57). Testado pelo Gustavo no iPhone pelo link público (Expo Go SDK 58, sem o Mac), tudo passou: "Sair" com Wi-Fi → login; modo avião → "Sair" → login; reabrir deslogado → login.

### T38 — Validação com usuários reais (Aula 16)
Status: em andamento · Responsável: Gustavo Trespach · Depende de: T36
Descrição: Teste do app com 5 usuários de fora do squad (iPhone pelo Expo Go e Android pelo APK), para a TDE "Validação com usuários reais" (entrega em 19/11). Inclui hipótese e métricas, tabela de feedback, matriz Impacto × Esforço e pelo menos 2 ajustes; os ajustes viram tarefas próprias depois das sessões. Antes das sessões, o APK 1.1.0 é gerado de novo com o backend novo (`versionCode` 3, mesma `version`, para o runtime continuar 1.1.0): o APK anterior tem a URL do backend antigo embutida, e na primeira abertura o login falhava até o EAS Update entrar.
Aceite: APK que abre direto no backend novo; sessões feitas; ajustes publicados; PDF `Validacao_CampusShare.pdf` entregue.

### T39 — Identidade visual nas telas restantes
Status: feito · Responsável: Gustavo Trespach · Depende de: T32
Descrição: A T32 aplicou o `docs/design/DESIGN.md` só nas telas da demo (1, 5, 6, 8 e 9). As telas 2 (Cadastro), 3 (Confira seu e-mail), 4 (Confirmação), 7 (Oferecer carona), 10 (Meu perfil), 11 (Meus veículos), 12 (Novo veículo) e 13 (Editar veículo) ainda usam cores fixas e o visual antigo. Só apresentação: nenhuma regra de negócio, chamada de backend ou navegação muda. Feita antes da validação com usuários reais (T38), que foi adiada pelo professor.
Aceite: telas 2, 3, 4, 7, 10, 11, 12 e 13 seguem as seções correspondentes do §4 do DESIGN.md e os "Estados comuns (tela 14)"; nenhuma cor, tamanho ou sombra escrita à mão nessas telas (só `tema.*`); nenhuma tela perde funcionalidade; lint, typecheck, testes e `expo-doctor` verdes.
Nota (19/11, Parte A): PR #59. Telas no §4 do DESIGN.md só com `tema.*` (grep de hex, tipografia e espaçamento: 83 → 0), sete componentes novos, 20 testes de renderização. Conferida pelo Gustavo no iPhone pelo `npx expo start`.
Nota (19/11, Parte B): EAS Update da `main` (`2184a13`, release #61 com Deploy verde) com runtime 1.1.0, grupo `21b7442c-8b4d-486e-9c33-fa9442a3d38f`, publicado junto com a T40; o runtime 1.0.0 continua com o update de 18/10 (SDK 57).

### T40 — Barra de busca de local na tela inicial
Status: feito · Responsável: Gustavo Trespach · Depende de: T39
Descrição: Na tela 5 (Caronas próximas), a fileira de chips "Perto de" dá lugar a uma barra de busca: o usuário digita um bairro, rua ou cidade, ou escolhe uma sugestão sem rede ("Minha localização" e os pontos fixos filtrados pelo texto). O texto livre é geocodificado pelo próprio aparelho (`Location.geocodeAsync` do expo-location, sem Google Places nem chave de API). O backend não muda: a busca continua sendo a `buscar_caronas(p_lat, p_lng, ...)` com o raio padrão de 10 km.
Aceite: o usuário digita um bairro de Torres ou uma cidade vizinha e vê as caronas próximas; os pontos fixos e "Minha localização" continuam a um toque; nenhuma chamada nova ao backend; lint, typecheck, testes e `expo-doctor` verdes.
Nota (19/11, Parte A): PR #60. Barra `BuscaLocal` com sugestões sem rede e texto livre geocodificado pelo aparelho (`Location.geocodeAsync`; no Android pede a permissão de localização na busca por texto; tempo máximo de 10 s), legenda "Caronas perto de: …", 23 testes novos; `buscar_caronas` sem mudança. Conferida pelo Gustavo no iPhone pelo `npx expo start`.
Nota (19/11, Parte B): EAS Update da `main` (`2184a13`, release #61 com Deploy verde) com runtime 1.1.0, grupo `21b7442c-8b4d-486e-9c33-fa9442a3d38f`, publicado junto com a T39; o runtime 1.0.0 continua com o update de 18/10 (SDK 57).

### T41 — Listas Minhas caronas e Minhas reservas mais legíveis
Status: feito · Responsável: Gustavo Trespach · Depende de: T28
Descrição: No teste da T28, "Minhas caronas" mostrava caronas de dias atrás no meio das próximas (com selo "Aberta": nada muda o status depois da partida até a T30) e o card começava pela data. As duas listas ganham as seções "Próximas" e "Anteriores" (recolhida), o card passa a começar por "Para <destino>" e "Saindo de <origem>" (nome curto, sem a UF), e carona aberta ou lotada depois da partida aparece como "Já partiu" nas listas e nos detalhes. Só apresentação: backend, services de escrita e regras não mudam, e o app não altera status.
Aceite: seções com a ordem certa e anteriores recolhidas por padrão; card "Para X / Saindo de Y"; selo "Já partiu" nas listas e nos detalhes; funções puras testadas; lint, typecheck, testes e `expo-doctor` verdes.
Nota (24/11, Parte A): `utils/listas.ts` (`nomeCurtoLocal`, `partidaPassada`, `situacaoExibidaCarona`, `caronaEhProxima`, `reservaEhProxima`, `separarPorPartida`, `textoBotaoAnteriores`) e componente `ListaPorPartida` (`SectionList`); selo `JA_PARTIU`. 24 testes novos (391 no total). DESIGN.md com as telas 9 e 16 novas e o selo.
Nota (24/11, Parte B): PR #69 e release #70 (Deploy sem migration, `health` 200). Conferida pelo Gustavo no iPhone: seções "Próximas"/"Anteriores", título "Para …" e selo "Já partiu". EAS Update único da `main` (`2bc2040`) com runtime 1.1.0, grupo `57d1e8e7-f9a2-4173-bc48-1f9523c95275` ("T28 e T41: cancelamentos e listas legíveis"); runtime 1.0.0 continua com o update de 18/10.
