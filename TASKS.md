# TASKS.md — CampusShare

Backlog técnico derivado das user stories (AP1) e do planejamento da Aula 08, revisado em 24/09 para backend direto no Supabase (ADR-009).
Cada tarefa = **1 branch** (`feature/T06-schema-inicial`) = **1 Pull Request**.

**Status:** `a fazer` · `em andamento` · `feito`
**Responsável:** preencher ao pegar a tarefa.

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
Status: a fazer · Depende de: T03
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
Status: a fazer · Depende de: T06, T07, T08
Descrição: Auth Hook Before User Created `validar_dominio_institucional` (recusa domínio fora de INSTITUICAO) e trigger `criar_perfil_usuario` (cria USUARIO a partir de `raw_user_meta_data`).
Aceite: e-mail `@rede.ulbra.br` cria usuário + perfil; outro domínio → erro `DOMINIO_INVALIDO`; e-mail duplicado → erro do Auth; testes pgTAP cobrindo os casos.

### T10 — Cliente Supabase no app
Status: a fazer · Depende de: T04, T05
Descrição: `@supabase/supabase-js` em `mobile/src/services/` com URL e anon key do `.env`, sessão persistida em armazenamento seguro (`expo-secure-store`), normalização de erros em `AppError` e tipos gerados (`supabase gen types`).
Aceite: app chama a Edge Function `health` e exibe o status.

### T11 — Tela de cadastro (US02)
Status: a fazer · Depende de: T09, T10
Descrição: Formulário com nome, e-mail institucional, senha, gênero e telefone (`auth.signUp` com metadata); aviso "confira seu e-mail" e botão de reenvio (`auth.resend`).
Aceite: erros do backend aparecem no campo certo; validação local de formato antes de enviar.

### T12 — Tela de login e sessão (US01)
Status: a fazer · Depende de: T08, T10
Descrição: Login com `auth.signInWithPassword`; rotas protegidas redirecionam para o login; botão de sair.
Aceite: login leva à Home; e-mail não confirmado mostra mensagem clara; senha errada mostra erro genérico; ao reabrir o app continua logado; logout limpa a sessão.

### T13 — Perfil do usuário
Status: a fazer · Depende de: T09, T10
Descrição: Tela de perfil lendo/atualizando a tabela `usuario` (só colunas liberadas) e view `perfil_publico`.
Aceite: usuário edita nome, telefone e gênero; não consegue alterar e-mail nem instituição; testes de RLS passam.

### T14 — Deploy do backend
Status: a fazer · Depende de: T09
Descrição: GitHub Actions na `main` rodando `supabase db push` e `supabase functions deploy`; segredos com `supabase secrets set`.
Aceite: `health` responde no projeto remoto; cadastro e login funcionam com o app apontando para o projeto.

---

## Sprint 2 — Veículos, caronas, reservas e pagamento

### T15 — Regras de veículos
Status: a fazer · Depende de: T06
Descrição: Políticas RLS de CRUD dos próprios veículos, CHECK de placa (antigo e Mercosul) e trigger que impede excluir veículo com carona ABERTA (`VEICULO_EM_USO`).
Aceite: usuário só vê e altera os próprios veículos (pgTAP); placa inválida é recusada.

### T16 — Tela de veículos
Status: a fazer · Depende de: T15, T10
Descrição: `consumo_kml` sugerido pela motorização, editável.
Aceite: cadastrar, listar, editar e excluir veículo pelo app.

### T17 — Publicar carona (US03, US07)
Status: a fazer · Depende de: T15
Descrição: Função SQL `publicar_carona` (RPC) com veículo, origem/destino (texto + lat/lng), data/hora, vagas, `custo_total` digitado, `tolerancia_min` e `somente_mulheres`; `id_motorista = auth.uid()`.
Aceite: RN04, RN05 e RN06 validadas na função; INSERT direto em `carona` pelo app é bloqueado; carona nasce `ABERTA`.

### T18 — Buscar caronas (US05)
Status: a fazer · Depende de: T17
Descrição: Funções `buscar_caronas(p_lat, p_lng, p_raio_km, p_somente_mulheres, p_data, p_pagina)` — bounding box + haversine, ordenado por proximidade e horário — e `detalhar_carona`.
Aceite: só caronas `ABERTA` e futuras (RN08); filtro "somente mulheres" funciona; telefone do motorista não aparece.

### T19 — Telas de publicar e buscar carona
Status: a fazer · Depende de: T17, T18
Aceite: motorista publica pelo app; Home lista caronas próximas com horário, vagas, valor e tolerância.

### T20 — Tabelas RESERVA, PAGAMENTO e PARAMETRO_CUSTO
Status: a fazer · Depende de: T06
Descrição: Migration das tabelas com RLS (leitura pelos participantes, sem escrita direta) e PARAMETRO_CUSTO inicial em migration idempotente.
Aceite: migration aplicada, testes de RLS passando e `docs/DATABASE.md` conferido.

### T21 — Função de reserva com rateio (US04)
Status: a fazer · Depende de: T18, T20
Descrição: Função SQL `reservar_vaga(p_id_carona, p_id_passageiro)` — `SELECT ... FOR UPDATE`, calcula `valor_individual` (RN11), valida RN14 e RN18, cria reserva `PENDENTE` e decrementa vagas; executável só pela `service_role`.
Aceite: teste de concorrência — duas chamadas simultâneas na última vaga, só uma passa; RN14 e RN18 cobertas em pgTAP.

### T22 — Edge Function de reserva + cobrança Pix sandbox (US04)
Status: a fazer · Depende de: T21
Descrição: `reservar-vaga`: valida o JWT, chama `reservar_vaga`, gera a cobrança no Mercado Pago (sandbox) e chama `registrar_pagamento` (PAGAMENTO `PENDENTE` com taxa e repasse — RN13). Se a cobrança falhar, cancela a reserva e devolve a vaga.
Aceite: resposta traz QR code / copia-e-cola do Pix; falha simulada do MP não deixa vaga presa (`deno test`).

### T23 — Webhook de pagamento
Status: a fazer · Depende de: T22
Descrição: Edge Function `webhook-mercado-pago` (`verify_jwt = false`) valida a assinatura, consulta a cobrança no MP e chama `confirmar_pagamento`: PAGAMENTO `APROVADO`, RESERVA `CONFIRMADA`, carona `LOTADA` quando zera vagas.
Aceite: idempotente (webhook repetido não duplica efeito); assinatura inválida → 401.

### T24 — Expiração de reservas pendentes
Status: a fazer · Depende de: T21
Descrição: Função `expirar_reservas()` agendada no pg_cron a cada minuto: marca `EXPIRADA` a reserva `PENDENTE` vencida e devolve a vaga (RN16).
Aceite: reserva não paga após o prazo libera a vaga automaticamente (pgTAP chamando a função com reserva antiga).

### T25 — Telas de reserva e pagamento
Status: a fazer · Depende de: T22, T23
Descrição: Tela de pagamento com o Pix e status atualizado via Realtime; tela "Minhas reservas".
Aceite: passageiro vê valor, paga pelo Pix sandbox e vê a reserva confirmada sem recarregar a tela.

---

## Sprint 3 — Sugestão de preço, notificações e avaliações

### T26 — Distância, sugestão de preço e teto (RN09, RN10)
Status: a fazer · Depende de: T17
Descrição: Edge Function `sugestao-preco` (Directions API) retorna `distancia_km` e `custo_estimado`; Edge Function `publicar-carona` recalcula o custo no servidor, aplica o teto e chama `publicar_carona`, que passa a ser executável só pela `service_role`.
Aceite: `custo_total > custo_estimado` → 422 `PRECO_ACIMA_DO_TETO`; fallback sem sugestão (e sem teto) se a Directions API falhar.

### T27 — Mapa na publicação e no detalhe
Status: a fazer · Depende de: T26
Aceite: motorista escolhe origem/destino no mapa; detalhe mostra a rota.

### T28 — Cancelar carona e reserva (US06)
Status: a fazer · Depende de: T23
Descrição: Funções RPC `cancelar_carona` e `cancelar_reserva`, devolvendo vagas na mesma transação; pagamentos aprovados passam a `REEMBOLSO_PENDENTE`.
Aceite: cancelamento da carona cancela todas as reservas ativas; só o dono cancela.

### T29 — Notificações (US06)
Status: a fazer · Depende de: T28
Descrição: Tabela NOTIFICACAO com RLS; coluna `expo_push_token` em USUARIO; triggers que gravam notificação ao reservar, confirmar e cancelar; Database Webhook no INSERT → Edge Function `enviar-push` (Expo Push API); tela de notificações com "marcar como lida".
Aceite: passageiros recebem push no cancelamento; motorista recebe push em nova reserva.

### T30 — Concluir carona e avaliações
Status: a fazer · Depende de: T23
Descrição: Função `concluir_carona`; tabela AVALIACAO com RLS; função `avaliar_participante` (RN19); média exposta em `perfil_publico`.
Aceite: só participantes avaliam, uma vez cada, após a conclusão.

### T31 — Build de demonstração (AP2)
Status: a fazer · Depende de: T25, T29
Descrição: Gerar builds Android (APK) e iOS pelo EAS e roteiro da demo.
Aceite: app instalado em pelo menos 2 celulares reais, fluxo completo cadastro → carona → reserva → pagamento sandbox funcionando.
