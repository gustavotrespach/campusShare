# API.md — Contratos do backend (Supabase)

Não existe API REST própria (ADR-009). O app fala com o Supabase pelo `@supabase/supabase-js` de quatro formas:

| Forma | Chamada no app | Quando usar |
|---|---|---|
| **Auth** | `supabase.auth.*` | Cadastro, login, sessão, reenvio de confirmação |
| **Tabela** | `supabase.from('veiculo').select()` | Leitura/escrita simples do próprio usuário, limitada pela RLS |
| **RPC** | `supabase.rpc('reservar_vaga', {...})` | Regras de negócio transacionais (funções SQL) |
| **Edge Function** | `supabase.functions.invoke('reservar-vaga', { body })` | Integrações com segredo (Pix, Directions, push) e webhook |

- Base URL: `http://localhost:54321` (dev) · `https://<ref>.supabase.co` (demo).
- Autenticação: o supabase-js envia o JWT da sessão automaticamente. Tudo exige usuário logado, exceto o marcado com 🔓.
- Formato: JSON (UTF-8). Datas em ISO 8601 UTC. Valores monetários em **reais com 2 casas** (`"valor_individual": 12.50`).
- Nomes no JSON seguem o banco (**snake_case**); os tipos TS vêm de `supabase gen types typescript`.
- Chamadas ao Supabase ficam só em `mobile/src/services/`.

## Padrão de erro

**Funções SQL** lançam o erro com o código do domínio na mensagem, a frase para o usuário em `hint` e o status HTTP no `errcode` (convenção `PTxxx` do PostgREST):

```sql
raise exception 'CARONA_LOTADA' using errcode = 'PT409', hint = 'Esta carona não tem mais vagas.';
```

O supabase-js devolve `{ code: 'PT409', message: 'CARONA_LOTADA', hint: 'Esta carona...', details }`.

**Edge Functions** respondem:
```json
{ "error": { "code": "DOMINIO_INVALIDO", "message": "Use seu e-mail institucional.", "details": { } } }
```

O serviço do app normaliza os dois formatos (e os erros do Auth) em `AppError { status, code, message }`.

| HTTP | Quando |
|---|---|
| 200 / 201 / 204 | Sucesso / criado / sem conteúdo |
| 400 | Payload inválido (Zod na Edge Function, ou parâmetro inválido na função SQL) — `details` traz os campos |
| 401 | Sem sessão, JWT inválido, credenciais incorretas, assinatura de webhook inválida |
| 403 | Autenticado, mas sem permissão (RLS ou dono do recurso) |
| 404 | Recurso não encontrado |
| 409 | Conflito (e-mail duplicado, carona lotada, reserva dupla) |
| 422 | Regra de negócio violada (domínio, teto de preço, somente mulheres) |
| 500 | Erro inesperado (mensagem genérica; detalhe só no log) |

## Sistema

| Tipo | Nome | Descrição |
|---|---|---|
| Edge Function 🔓 | `health` | `{ "status": "ok" }` |

## auth (US01, US02) — Supabase Auth

| Chamada | Descrição |
|---|---|
| `auth.signUp({ email, password, options: { data } })` | Cria usuário; o hook valida o domínio; o Auth envia o e-mail de confirmação |
| Link do e-mail (`/auth/v1/verify`) | Ativa a conta e redireciona para o app |
| `auth.resend({ type: 'signup', email })` | Reenvia o link |
| `auth.signInWithPassword({ email, password })` | Retorna a sessão (access token + refresh token) |
| `auth.signOut()` | Encerra a sessão |

```ts
// cadastro
await supabase.auth.signUp({
  email: 'mariana@rede.ulbra.br',
  password: '********',
  options: {
    data: { nome_completo: 'Mariana Souza', genero: 'FEMININO', telefone: '51999999999' },
  },
});
// erros: DOMINIO_INVALIDO (hook, 422) · user_already_exists (409) · weak_password (422)

// login
await supabase.auth.signInWithPassword({ email: 'mariana@rede.ulbra.br', password: '********' });
// erros: invalid_credentials (400 → tratado como 401 genérico) · email_not_confirmed (403)
```

Os dados de `options.data` são copiados para a tabela `usuario` pelo trigger `criar_perfil_usuario`.

## usuarios

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `usuario` — `select` | Só a própria linha (RLS) |
| Tabela | `usuario` — `update` | Só a própria linha; colunas `nome_completo`, `telefone`, `genero`, `expo_push_token` |
| View | `perfil_publico` — `select` | Nome e média de avaliações de qualquer usuário (sem e-mail, telefone ou gênero) |

## veiculos

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `veiculo` — `select/insert/update/delete` | Só os do próprio usuário (RLS; `id_motorista` preenchido com `auth.uid()` por default) |

Constraints no banco: placa no padrão antigo ou Mercosul, `qtd_lugares` de 2 a 8, `consumo_kml > 0`. DELETE recusado (`VEICULO_EM_USO`, 409) se houver carona ABERTA com o veículo.

```ts
await supabase.from('veiculo').insert({
  modelo: 'Onix', placa: 'ABC1D23', cor: 'Prata', qtd_lugares: 5,
  motorizacao: '1.0', consumo_kml: 13.5,
});
```

## caronas (US03, US05, US07)

| Tipo | Nome | Descrição |
|---|---|---|
| RPC | `buscar_caronas(p_lat, p_lng, p_raio_km = 10, p_somente_mulheres = false, p_data = null, p_pagina = 1)` | Caronas ABERTA e futuras, por proximidade e horário (RN08) |
| RPC | `detalhar_carona(p_id_carona)` | Motorista (perfil público), veículo, vagas, valor, tolerância |
| Tabela | `carona` — `select` | Leitura das próprias caronas publicadas (RLS) |
| RPC | `publicar_carona(...)` | Sprint 2: publica com `custo_total` digitado (RN04–RN06) |
| Edge Function | `sugestao-preco` | Sprint 3: `distancia_km` e `custo_estimado` |
| Edge Function | `publicar-carona` | Sprint 3: recalcula `custo_estimado` e aplica o teto (RN10); passa a ser o único caminho de publicação |
| RPC | `cancelar_carona(p_id_carona)` | Só o motorista; cancela reservas ativas e notifica (US06) |
| RPC | `concluir_carona(p_id_carona)` | Só o motorista, após a partida |

```ts
// publicar (Sprint 2: rpc; Sprint 3: functions.invoke('publicar-carona', { body }))
await supabase.rpc('publicar_carona', {
  p_id_veiculo: 'uuid',
  p_origem: 'Av. Beira Mar, 100 — Arroio do Sal', p_origem_lat: -29.55, p_origem_lng: -49.89,
  p_destino: 'ULBRA Torres', p_destino_lat: -29.33, p_destino_lng: -49.73,
  p_data_hora_partida: '2026-10-05T10:30:00Z', p_vagas_disponiveis: 3,
  p_custo_total: 24.0, p_tolerancia_min: 10, p_somente_mulheres: false,
});
// 422 PRECO_ACIMA_DO_TETO · 422 SEM_VEICULO · 400 PARTIDA_NO_PASSADO · 422 VAGAS_ACIMA_DO_LIMITE
```

```json
// POST /functions/v1/sugestao-preco
{ "origem_lat": -29.55, "origem_lng": -49.89, "destino_lat": -29.33, "destino_lng": -49.73,
  "id_veiculo": "uuid" }
// 200
{ "data": { "distancia_km": 32.4, "custo_estimado": 14.80 } }
```

## reservas (US04)

| Tipo | Nome | Descrição |
|---|---|---|
| Edge Function | `reservar-vaga` | Reserva a vaga (função SQL `reservar_vaga`), calcula o rateio e gera a cobrança Pix |
| Tabela | `reserva` — `select` | Passageiro vê as próprias; motorista vê as das suas caronas (RLS) |
| RPC | `cancelar_reserva(p_id_reserva)` | Passageiro cancela; devolve a vaga |

A função SQL `reservar_vaga` só pode ser executada pela `service_role` (Edge Function), para que nenhuma reserva nasça sem cobrança.

```json
// POST /functions/v1/reservar-vaga
{ "id_carona": "uuid" }
// 201
{ "data": {
    "id_reserva": "uuid", "status": "PENDENTE", "valor_individual": 6.00,
    "expira_em": "2026-10-04T18:15:00Z",
    "pix": { "qr_code": "base64...", "copia_e_cola": "00020126..." } } }
// 409 CARONA_LOTADA · 409 RESERVA_DUPLICADA · 422 SOMENTE_MULHERES · 422 PROPRIA_CARONA
```

O app acompanha a confirmação assinando mudanças da própria reserva via **Realtime** (`supabase.channel(...).on('postgres_changes', ...)`).

## pagamentos

| Tipo | Nome | Descrição |
|---|---|---|
| Edge Function 🔓 | `webhook-mercado-pago` | Notificação do Mercado Pago (`verify_jwt = false`; assinatura validada) — idempotente |
| Tabela | `pagamento` — `select` | Status do pagamento das próprias reservas (RLS) |

## notificacoes (US06)

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `notificacao` — `select` | Do próprio usuário, mais recentes primeiro |
| Tabela | `notificacao` — `update` | Só a coluna `lida`, da própria notificação |
| Edge Function (interna) | `enviar-push` | Chamada pelo Database Webhook no INSERT de `notificacao`; envia push pela Expo |

## avaliacoes

| Tipo | Nome | Descrição |
|---|---|---|
| RPC | `avaliar_participante(p_id_reserva, p_id_avaliado, p_nota, p_comentario)` | RN19 |
| Tabela | `avaliacao` — `select` | Avaliações recebidas por um usuário; média em `perfil_publico` |
