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
| 21–22/10 | | | T31 (build e roteiro da demo) |

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
Status: adiada (pós-AP2) · Depende de: T21
Descrição: Função `expirar_reservas()` agendada no pg_cron a cada minuto: marca `EXPIRADA` a reserva `PENDENTE` vencida e devolve a vaga (RN16).
Aceite: reserva não paga após o prazo libera a vaga automaticamente (pgTAP chamando a função com reserva antiga).

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
Status: adiada (pós-AP2) · Depende de: T23
Descrição: Funções RPC `cancelar_carona` e `cancelar_reserva`, devolvendo vagas na mesma transação; pagamentos aprovados passam a `REEMBOLSO_PENDENTE`.
Aceite: cancelamento da carona cancela todas as reservas ativas; só o dono cancela.

### T29 — Notificações (US06)
Status: adiada (pós-AP2) · Depende de: T28
Descrição: Tabela NOTIFICACAO com RLS; coluna `expo_push_token` em USUARIO; triggers que gravam notificação ao reservar, confirmar e cancelar; Database Webhook no INSERT → Edge Function `enviar-push` (Expo Push API); tela de notificações com "marcar como lida".
Aceite: passageiros recebem push no cancelamento; motorista recebe push em nova reserva.

### T30 — Concluir carona e avaliações
Status: adiada (pós-AP2) · Depende de: T23
Descrição: Função `concluir_carona`; tabela AVALIACAO com RLS; função `avaliar_participante` (RN19); view `perfil_publico` (nome + média, sem e-mail, telefone ou gênero — movida da T13 em 16/10).
Aceite: só participantes avaliam, uma vez cada, após a conclusão.

### T31 — Build de demonstração (AP2)
Status: a fazer · Depende de: T19, T25 (até 16/10: T25, T29)
Descrição: Gerar builds Android (APK) e iOS pelo EAS e roteiro da demo.
Aceite: app instalado em pelo menos 2 celulares reais, fluxo completo cadastro → carona → reserva → pagamento sandbox funcionando.
Nota (16/10): o projeto EAS será criado com o nome `campusshare` só nesta tarefa. Build de iOS instalável em aparelho exige conta paga do Apple Developer Program, fora do orçamento zero; para a demo, decidido (16/10): APK no Android e Expo Go no iPhone.
