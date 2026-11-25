# API.md — Contratos do backend (Supabase)

Não existe API REST própria (ADR-009). O app fala com o Supabase pelo `@supabase/supabase-js` de quatro formas:

| Forma | Chamada no app | Quando usar |
|---|---|---|
| **Auth** | `supabase.auth.*` | Cadastro, login, sessão, reenvio de confirmação |
| **Tabela** | `supabase.from('veiculo').select()` | Leitura/escrita simples do próprio usuário, limitada pela RLS |
| **RPC** | `supabase.rpc('publicar_carona', {...})` | Regras de negócio transacionais (funções SQL) |
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
| 409 | Conflito (e-mail duplicado, carona lotada, reserva dupla, veículo em uso) |
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
// erros (AuthApiError: status + code + message):
//   422 msg 'DOMINIO_INVALIDO' (hook; error_code 'unknown' — use a mensagem como código)
//   422 user_already_exists (e-mail já confirmado) · 422 weak_password (menos de 8 caracteres)
// e-mail já cadastrado e ainda não confirmado: o Auth responde 200 sem revelar que a conta existe

// login
await supabase.auth.signInWithPassword({ email: 'mariana@rede.ulbra.br', password: '********' });
// erros: invalid_credentials (400 → tratado como 401 genérico) · email_not_confirmed (400 → mensagem clara)
```

Os dados de `options.data` são copiados para a tabela `usuario` pelo trigger `criar_perfil_usuario` (`genero` ausente ou inválido → `NAO_INFORMADO`; sem `nome_completo` → parte do e-mail antes do `@`). O app envia `emailRedirectTo` = `campusshare://confirmacao` (app instalado) ou `exp://<host>:8081/--/confirmacao` (Expo Go); o link do e-mail volta para essa rota com a sessão no fragmento (`#access_token=...&refresh_token=...&type=signup`) ou com o erro (`#error=access_denied&error_code=otp_expired&...`), e o app chama `auth.setSession`. Redirect com host IP literal é recusado pela allowlist e cai no `site_url`.

## usuarios

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `usuario` — `select` | Só a própria linha (RLS) |
| Tabela | `usuario` — `update` | Só a própria linha; colunas `nome_completo`, `telefone`, `genero`, `expo_push_token` |
| RPC | `perfil_publico(p_id_usuario)` | Nome, média e total de avaliações de qualquer usuário (sem e-mail, telefone ou gênero) e, desde a T44, `foto_caminho`. Função, não view (T30; contrato em "avaliacoes") |
| RPC | `definir_foto_perfil()` → `timestamptz` | Depois do upload, confirma a foto do usuário logado (T44) |
| RPC | `remover_foto_perfil()` | Depois de apagar o arquivo, tira a foto do perfil (T44) |
| Storage | bucket `fotos-perfil` (privado) | Foto de perfil em `<id_usuario>/avatar.jpg`: JPEG, até 1 MB (T44) |

**Foto de perfil (T44).** Opcional e removível; sem foto, o app mostra as iniciais. Caminho fixo
`<auth.uid()>/avatar.jpg` no bucket privado `fotos-perfil` (só `image/jpeg`, até 1 MB). A coluna
`usuario.foto_atualizada_em` é lida pelo `select` do próprio perfil (nula = sem foto), mas o app não a
escreve: só pelas duas RPCs.

```ts
const caminho = `${idUsuario}/avatar.jpg`;
// 1. Enviar (ou trocar): o upsert usa as políticas de INSERT e UPDATE do próprio caminho
await supabase.storage.from('fotos-perfil').upload(caminho, arquivoJpeg, {
  upsert: true,
  contentType: 'image/jpeg',
});
// 2. Confirmar: confere que o arquivo existe e grava a data (vira o ?v= do caminho)
const { data: definidaEm } = await supabase.rpc('definir_foto_perfil');

// Remover: apagar o arquivo pela API do Storage e depois zerar a coluna
await supabase.storage.from('fotos-perfil').remove([caminho]);
await supabase.rpc('remover_foto_perfil');
```

Leitura: as funções devolvem `foto_caminho` (`perfil_publico`) ou `foto_motorista` (`detalhar_carona`,
`buscar_caronas`) como `'<id>/avatar.jpg?v=<época>'`, ou nulo sem foto (o `gen types` tipa como
`string`; o service trata como `string | null`). O bucket é privado: a imagem sai de
`GET <SUPABASE_URL>/storage/v1/object/authenticated/fotos-perfil/<foto_caminho>` com o header
`Authorization: Bearer <access_token da sessão>` (e o `apikey`). O `?v=` não muda o arquivo pedido: muda a
cada troca e serve de chave de cache, para o app não mostrar a foto antiga. Sem sessão, o Storage recusa
(`anon` não tem política de leitura).

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão (as duas RPCs) |
| 409 | `FOTO_NAO_ENVIADA` | A foto não chegou ao servidor. Tente enviar de novo. | `definir_foto_perfil` sem o arquivo `<uid>/avatar.jpg` no bucket |

## veiculos

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `veiculo` — `select/insert/update/delete` | Só os do próprio usuário (RLS; `id_motorista` preenchido com `auth.uid()` por default) |

Constraints no banco: placa no padrão antigo ou Mercosul (maiúsculas, sem hífen) e única, `qtd_lugares` de 2 a 8, `consumo_kml > 0`.

DELETE recusado pelo trigger `impedir_exclusao_veiculo_em_uso` quando o veículo tem caronas:

| HTTP | `message` (código) | `hint` (frase para o usuário) | Quando |
|---|---|---|---|
| 409 | `VEICULO_EM_USO` | Este veículo está em uma carona ativa. Cancele ou conclua a carona antes de excluí-lo. | Alguma carona `ABERTA` ou `LOTADA` com o veículo |
| 409 | `VEICULO_COM_HISTORICO` | Este veículo tem caronas registradas no histórico e não pode ser excluído. | Só caronas `CONCLUIDA`/`CANCELADA` |

DELETE ou UPDATE no veículo de outro motorista não falha, mas não afeta nenhuma linha (RLS). O app trata a resposta vazia como "Veículo não encontrado.".

Placa já cadastrada (em qualquer conta) no INSERT ou UPDATE: HTTP 409 com `code = 23505` e `veiculo_placa_key` na `message`. O service `veiculos.ts` traduz para `PLACA_DUPLICADA`, "Esta placa já está cadastrada.", mostrado no campo da placa.

```ts
await supabase.from('veiculo').insert({
  modelo: 'Onix', placa: 'ABC1D23', cor: 'Prata', qtd_lugares: 5,
  motorizacao: '1.0', consumo_kml: 13.5,
});
```

## caronas (US03, US05, US07)

| Tipo | Nome | Descrição |
|---|---|---|
| RPC | `buscar_caronas(p_lat, p_lng, p_raio_km = 10, p_somente_mulheres = false, p_data = null, p_pagina = 1)` | Caronas ABERTA, com vaga e futuras, por proximidade da origem e horário (RN08); páginas de 20; com a nota do motorista desde a T43 |
| RPC | `detalhar_carona(p_id_carona)` | Uma carona: motorista (nome), veículo com placa, vagas, valor por passageiro, tolerância |
| Tabela | `carona` — `select` | Leitura das próprias caronas publicadas (RLS) |
| RPC | `publicar_carona(...)` → `uuid` | Sprint 2: publica com `custo_total` digitado (RN04–RN06); único caminho de criação (o app não tem INSERT em `carona`) |
| Edge Function | `sugestao-preco` | Sprint 3: `distancia_km` e `custo_estimado` |
| Edge Function | `publicar-carona` | Sprint 3: recalcula `custo_estimado` e aplica o teto (RN10); passa a ser o único caminho de publicação |
| RPC | `cancelar_carona(p_id_carona)` → `integer` | Só o motorista, antes da partida; cancela as reservas ativas (T28). A notificação aos passageiros (US06) vem com o módulo de notificações |
| RPC | `concluir_carona(p_id_carona)` → `integer` | Só o motorista, entre a partida e 1 dia depois (T30; contrato em "avaliacoes") |

```ts
// publicar (Sprint 2: rpc; Sprint 3: functions.invoke('publicar-carona', { body }))
const { data: idCarona } = await supabase.rpc('publicar_carona', {
  p_id_veiculo: 'uuid',
  p_origem: 'Av. Beira Mar, 100 — Arroio do Sal', p_origem_lat: -29.55, p_origem_lng: -49.89,
  p_destino: 'ULBRA Torres', p_destino_lat: -29.33, p_destino_lng: -49.73,
  p_data_hora_partida: '2026-10-05T10:30:00Z', p_vagas_ofertadas: 3,
  p_custo_total: 24.0, p_tolerancia_min: 10, p_somente_mulheres: false,
});
```

`publicar_carona(p_id_veiculo uuid, p_origem text, p_origem_lat numeric, p_origem_lng numeric, p_destino text, p_destino_lat numeric, p_destino_lng numeric, p_data_hora_partida timestamptz, p_vagas_ofertadas int, p_custo_total numeric, p_tolerancia_min int, p_somente_mulheres boolean default false) returns uuid`

- O motorista é sempre o usuário da sessão (`auth.uid()`), nunca um parâmetro.
- `p_vagas_ofertadas`: vagas oferecidas a passageiros. A carona nasce `ABERTA` com `vagas_ofertadas = vagas_disponiveis` (RN11).
- `p_custo_total` em **reais** com até 2 casas (o app converte de centavos na fronteira). Sem teto na Sprint 2 (RN12): `custo_estimado` e `distancia_km` ficam nulos.
- `p_data_hora_partida` em UTC (ISO 8601). `origem` e `destino` são gravados com `trim`.
- Vagas e tolerância são inteiros: um valor fracionário (ex.: `2.5`) é recusado pelo PostgREST antes da função, com `22P02`.

Erros (validados nesta ordem; a frase para o usuário vem no `hint`):

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão |
| 422 | `SEM_VEICULO` | Cadastre um veículo antes de oferecer uma carona. | Usuário sem nenhum veículo (RN04) |
| 404 | `VEICULO_NAO_ENCONTRADO` | Veículo não encontrado. Escolha um dos seus veículos. | Veículo inexistente ou de outro motorista (mesma resposta) |
| 400 | `DADOS_INVALIDOS` | Ofereça pelo menos 1 vaga. | `p_vagas_ofertadas` < 1 |
| 422 | `VAGAS_ACIMA_DO_LIMITE` | Este veículo comporta no máximo N vagas para passageiros. | `p_vagas_ofertadas` > `qtd_lugares − 1` (RN05) |
| 400 | `DADOS_INVALIDOS` | Informe a data e a hora de partida. | Partida ausente |
| 400 | `PARTIDA_NO_PASSADO` | Escolha uma data e hora de partida no futuro. | Partida ≤ agora (RN06) |
| 400 | `DADOS_INVALIDOS` | Frase específica do campo | Origem/destino vazio ou com mais de 200 caracteres; coordenada fora da faixa; custo ≤ 0, com mais de 2 casas ou acima do limite da coluna; tolerância fora de 0 a 30 (US07) |

Sprint 3 (Edge Function `publicar-carona`): `422 PRECO_ACIMA_DO_TETO` (RN10).

**Buscar e detalhar (T18).** As duas RPCs são `SECURITY DEFINER` e devolvem só colunas públicas (sem telefone, e-mail nem `id_motorista`); o app não lê `carona` de outros motoristas direto na tabela.

```ts
const { data: caronas } = await supabase.rpc('buscar_caronas', {
  p_lat: -29.3353, p_lng: -49.7268,          // ponto do passageiro
  p_raio_km: 10, p_somente_mulheres: false,  // opcionais
  p_data: '2026-10-20',                      // opcional: dia em America/Sao_Paulo
  p_pagina: 1,
});
const { data: [detalhe] } = await supabase.rpc('detalhar_carona', { p_id_carona: 'uuid' });
```

`buscar_caronas(p_lat numeric, p_lng numeric, p_raio_km numeric default 10, p_somente_mulheres boolean default false, p_data date default null, p_pagina int default 1)`:
- Só `ABERTA`, com `vagas_disponiveis > 0` e partida no futuro (RN08), com a **origem** a até `p_raio_km` do ponto (bounding box + haversine).
- Não mostra as caronas do próprio usuário (RN14). Caronas `somente_mulheres` só aparecem para usuárias com `genero = FEMININO` (RN18); com `p_somente_mulheres = true`, só elas aparecem.
- `p_data` é o dia em `America/Sao_Paulo` (23:30 de Brasília conta no próprio dia, mesmo sendo o dia seguinte em UTC).
- Ordem: distância e depois horário. 20 por página; página além do fim vem vazia.
- Colunas: `id_carona`, `origem`, `origem_lat`, `origem_lng`, `destino`, `destino_lat`, `destino_lng`, `data_hora_partida`, `vagas_disponiveis`, `tolerancia_min`, `somente_mulheres`, `distancia_km` (do ponto do passageiro até a origem, 1 casa), `valor_por_passageiro` (reais, 2 casas), `nome_motorista` (só o primeiro nome), `modelo`, `cor` e, desde a T43 (migration `nota_motorista_busca`, `drop` + `create`, no fim), `media_motorista` (média das avaliações recebidas pelo motorista, 1 casa, **nula** sem avaliações, embora o `gen types` a tipe como `number`) e `total_avaliacoes_motorista`, pela mesma conta do `perfil_publico` (`resumo_avaliacoes`). A lista inteira sai numa consulta: o app não chama nada por card. Continua sem id, e-mail, telefone ou gênero do motorista; parâmetros, filtros, ordem, paginação, erros e grants iguais aos da T18. Desde a T44 (migration `foto_perfil`), também `foto_motorista` no fim (`'<id>/avatar.jpg?v=<época>'` ou nulo sem foto; ver "usuarios").

`detalhar_carona(p_id_carona uuid)` devolve uma linha com as colunas da busca (sem `distancia_km`) mais `vagas_ofertadas`, `status`, `custo_total`, `placa` (para reconhecer o carro no embarque), `sou_motorista` e `nome_motorista` com o nome completo (perfil público); desde a T30, `media_motorista` e `total_avaliacoes_motorista`; desde a T44, `foto_motorista` no fim (caminho com `?v=` ou nulo).
- Visível para o motorista (qualquer status), para quem tem reserva na carona (qualquer status) e, para os demais, se estiver `ABERTA` e futura (e, se `somente_mulheres`, para usuárias).

`valor_por_passageiro = round(custo_total ÷ (vagas_ofertadas + 1), 2)` (RN11) vem da função SQL única `valor_por_passageiro`, a mesma que a `reservar_vaga` (T21) usa para cobrar. A sobra de centavos fica com o motorista (R$ 25,00 com 2 vagas → R$ 8,33).

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão (as duas RPCs) |
| 400 | `DADOS_INVALIDOS` | Sua localização é inválida. Tente de novo. | Coordenadas ausentes ou fora da faixa |
| 400 | `DADOS_INVALIDOS` | O raio da busca deve ser de 1 a 50 km. | `p_raio_km` fora de 1 a 50 |
| 400 | `DADOS_INVALIDOS` | Página inválida. | `p_pagina` < 1 |
| 404 | `CARONA_NAO_ENCONTRADA` | Carona não encontrada ou não está mais disponível. | Detalhe de carona inexistente ou fora da visibilidade (mesma resposta) |

**Cancelar carona (T28).**

```ts
const { data: reservasCanceladas } = await supabase.rpc('cancelar_carona', { p_id_carona: 'uuid' });
```

`cancelar_carona(p_id_carona uuid) returns integer`:
- O motorista é o usuário da sessão (`auth.uid()`). Sem o limite de 2 h da RN20: vale até a partida (RN07).
- Numa transação, com a carona travada e depois as reservas ativas e os pagamentos delas: a carona vira `CANCELADA`; cada reserva `PENDENTE` ou `CONFIRMADA` vira `CANCELADA`, com o pagamento `PENDENTE` → `RECUSADO` e `APROVADO` → `REEMBOLSO_PENDENTE`. Reservas já `CANCELADA`/`EXPIRADA` não mudam.
- `vagas_disponiveis` não muda: a carona cancelada some da `buscar_caronas` e não aceita reserva (`CARONA_INDISPONIVEL`).
- Devolve quantas reservas cancelou (0 se não havia). Um Pix pago depois disso vira `REEMBOLSO_PENDENTE` no webhook.

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão |
| 404 | `CARONA_NAO_ENCONTRADA` | Carona não encontrada. | Carona inexistente ou de outro motorista (mesma resposta) |
| 409 | `CANCELAMENTO_ENCERRADO` | Esta carona já partiu ou foi encerrada; não dá mais para cancelar. | Carona `CANCELADA`/`CONCLUIDA` ou partida já passada |

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
| Edge Function | `reservar-vaga` | Reserva a vaga (função SQL `reservar_vaga`) e gera a cobrança Pix no Mercado Pago (API de Orders, sandbox) — T22 |
| Tabela | `reserva` — `select` | Passageiro vê as próprias; motorista vê as das suas caronas (RLS) |
| RPC | `minhas_reservas()` | Reservas do usuário logado para a tela "Minhas reservas" (T25) |
| RPC | `cancelar_reserva(p_id_reserva)` → `text` | Passageiro cancela a própria reserva e a vaga volta (RN20, T28) |

`minhas_reservas() returns table (id_reserva, status_reserva, reservado_em, status_pagamento, valor, id_carona, origem, destino, data_hora_partida, status_carona, nome_motorista, media_motorista, total_avaliacoes_motorista)` (T25; as duas últimas colunas desde a T42): só as reservas do `auth.uid()`, mais recentes primeiro (`reservado_em` desc), em qualquer status. `valor` é o do pagamento (decimal em reais; o app converte para centavos no service) e `nome_motorista` é só o primeiro nome. `media_motorista` é a média das avaliações recebidas pelo motorista com 1 casa (**nula** sem avaliações, embora o `gen types` a tipe como `number`) e `total_avaliacoes_motorista` o total, pela mesma conta do `perfil_publico` (`resumo_avaliacoes`): a lista inteira sai numa consulta, sem chamar a `detalhar_carona` por item. Sem e-mail, telefone, gênero nem id do motorista. Sem sessão → 401 `NAO_AUTENTICADO`; `anon` não executa. Existe porque o passageiro não lê a tabela `carona` (só o motorista lê as próprias).

**Cancelar reserva (T28).**

```ts
const { data: status } = await supabase.rpc('cancelar_reserva', { p_id_reserva: 'uuid' }); // 'CANCELADA'
```

`cancelar_reserva(p_id_reserva uuid) returns text`:
- O passageiro é o usuário da sessão (`auth.uid()`); só a própria reserva.
- RN20: reserva `PENDENTE` pode ser cancelada até a partida (pagamento `PENDENTE` → `RECUSADO`); reserva `CONFIRMADA` (paga), até **2 horas** antes da partida (pagamento `APROVADO` → `REEMBOLSO_PENDENTE`; o reembolso em si ainda é manual).
- Numa transação, com a carona travada, depois a reserva (status conferido de novo) e o pagamento: reserva `CANCELADA`, uma vaga devolvida e carona `LOTADA` → `ABERTA` (RN17).
- Devolve o status final, `CANCELADA`. Chamar de novo dá `RESERVA_JA_ENCERRADA` e não devolve a vaga outra vez. Um Pix pago depois do cancelamento vira `REEMBOLSO_PENDENTE` no webhook, sem mexer na vaga.

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão |
| 404 | `RESERVA_NAO_ENCONTRADA` | Reserva não encontrada. | Reserva inexistente ou de outro usuário (mesma resposta) |
| 409 | `RESERVA_JA_ENCERRADA` | Esta reserva já foi cancelada ou expirou. | Reserva `CANCELADA` ou `EXPIRADA` |
| 409 | `CANCELAMENTO_ENCERRADO` | Esta carona já partiu ou foi encerrada; não dá mais para cancelar. | Partida já passou, ou carona `CANCELADA`/`CONCLUIDA` |
| 409 | `PRAZO_CANCELAMENTO_ENCERRADO` | Reservas pagas só podem ser canceladas até 2 horas antes da partida. | Reserva `CONFIRMADA` a menos de 2 h da partida (RN20) |

A função SQL `reservar_vaga` só pode ser executada pela `service_role` (Edge Function), para que nenhuma reserva nasça sem cobrança. O app chama a Edge Function, nunca a função.

`reservar_vaga(p_id_carona uuid, p_id_passageiro uuid) returns table (id_reserva, id_pagamento, valor_individual, taxa_plataforma, valor_repassado, status)` (T21):
- `p_id_passageiro` é o usuário do JWT validado pela Edge Function, nunca um campo do corpo enviado pelo app.
- Numa transação, com a carona travada (`FOR UPDATE`): valida, grava a reserva `PENDENTE` com `valor_individual = valor_por_passageiro(custo_total, vagas_ofertadas)` (RN11, o mesmo valor da busca), grava o pagamento `PENDENTE` (`PIX`, `id_externo` nulo) com `taxa_plataforma = round(valor × percentual_taxa, 2)` e `valor_repassado = valor − taxa` (RN13, taxa do `parametro_custo` mais recente) e baixa uma vaga; com 0 vagas a carona vira `LOTADA`.
- A reserva `PENDENTE` ocupa a vaga até ser paga ou expirar: sem pagamento confirmado em **15 minutos** (desde `reserva.criado_em`), o job `expirar-reservas` (pg_cron, a cada minuto) a marca `EXPIRADA`, recusa o pagamento e devolve a vaga (RN16, T24). Um Pix pago depois disso vira `REEMBOLSO_PENDENTE`.
- Exemplo: R$ 24,00 com 3 vagas → R$ 6,00, taxa R$ 0,60, repasse R$ 5,40. R$ 25,00 com 2 vagas → R$ 8,33, R$ 0,83, R$ 7,50.

Erros (validados nesta ordem; a Edge Function repassa ao app):

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 404 | `CARONA_NAO_ENCONTRADA` | Carona não encontrada ou não está mais disponível. | Carona inexistente |
| 404 | `USUARIO_NAO_ENCONTRADO` | Não encontramos seu perfil. Saia e entre novamente. | Passageiro sem linha em `usuario` |
| 422 | `RESERVA_PROPRIA_CARONA` | Você não pode reservar uma vaga na sua própria carona. | Motorista = passageiro (RN14) |
| 403 | `CARONA_SOMENTE_MULHERES` | Esta carona é exclusiva para mulheres. | Carona `somente_mulheres` e passageiro sem `genero = FEMININO` (RN18) |
| 409 | `CARONA_INDISPONIVEL` | Esta carona não está mais disponível para reserva. | `CANCELADA`, `CONCLUIDA` ou partida já passada (RN08) |
| 409 | `CARONA_LOTADA` | Esta carona não tem mais vagas. | `LOTADA` ou sem vagas (inclusive quem perdeu a disputa pela última vaga) |
| 409 | `RESERVA_DUPLICADA` | Você já tem uma reserva nesta carona. | Já existe reserva `PENDENTE`/`CONFIRMADA` do passageiro (RN14) |
| 422 | `VALOR_ABAIXO_DO_MINIMO` | O valor por passageiro desta carona é menor que R$ 0,01. | `custo_total` tão baixo que o rateio dá R$ 0,00 |
| 500 | `PARAMETRO_AUSENTE` | Não foi possível calcular o valor agora. Tente mais tarde. | Nenhum `parametro_custo` cadastrado |

Leitura direta pelo app (tabelas criadas na T20; INSERT, UPDATE e DELETE recusados com `42501` para `authenticated`):

```ts
// Passageiro: as próprias reservas. Motorista: as reservas das próprias caronas (mesma consulta; a RLS filtra)
await supabase
  .from('reserva')
  .select('id_reserva, id_carona, id_passageiro, valor_individual, status, criado_em')
  .eq('id_carona', idCarona);
```

Colunas de `reserva`: `id_reserva`, `id_carona`, `id_passageiro`, `valor_individual` (reais, 2 casas), `status` (`PENDENTE`, `CONFIRMADA`, `CANCELADA`, `EXPIRADA`), `criado_em`.

```json
// POST /functions/v1/reservar-vaga   (Authorization: Bearer <JWT do usuário>)
{ "id_carona": "uuid" }
// 201
{ "data": {
    "id_reserva": "uuid", "id_pagamento": "uuid", "valor_centavos": 500, "status": "PENDENTE",
    "pix": { "qr_code": "00020126...", "qr_code_base64": "iVBORw0...", "ticket_url": "https://..." } } }
```

```ts
const { data, error } = await supabase.functions.invoke('reservar-vaga', {
  body: { id_carona: idCarona },
});
```

Contrato da Edge Function `reservar-vaga` (T22, `verify_jwt = true`):
- Corpo: só `id_carona` (uuid). Qualquer outro campo, inclusive o passageiro, é recusado (400): o passageiro é o usuário do JWT, validado no Auth.
- Fluxo: `reservar_vaga` → cobrança Pix na API de Orders do Mercado Pago (`X-Idempotency-Key` = `id_pagamento`, `external_reference` = `id_pagamento`) → `registrar_cobranca` (grava o id da order em `pagamento.id_externo`).
- Resposta 201: valor em **centavos**; `pix.qr_code` é o "copia e cola"; `qr_code_base64` é a imagem PNG (pode vir `null` no sandbox); `ticket_url` abre a página do Pix. Taxa, repasse e id da order não vão para o app.
- A reserva fica `PENDENTE` até o webhook confirmar o pagamento (T23, ADR-008).

Erros (formato das Edge Functions: `{ "error": { "code", "message", "details" } }`):

| HTTP | `code` | `message` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Entre na sua conta para reservar. / Sua sessão expirou. Entre novamente. | Sem JWT, ou JWT recusado pelo Auth |
| 400 | `PAYLOAD_INVALIDO` | Dados inválidos. | Corpo sem `id_carona` uuid, ou com campos a mais (`details.campos`) |
| 405 | `METODO_NAO_PERMITIDO` | Use POST para reservar. | Método diferente de POST |
| 404, 403, 409, 422, 500 | os códigos da `reservar_vaga` | a frase do `hint` | Repassados com o mesmo status (tabela acima): `CARONA_LOTADA`, `RESERVA_DUPLICADA`, `CARONA_SOMENTE_MULHERES`... |
| 502 | `PAGAMENTO_INDISPONIVEL` | Não foi possível gerar o Pix agora. Tente de novo em instantes. | Mercado Pago com erro, timeout (10 s) ou sem QR Code: a reserva é desfeita e a vaga volta (`desfazer_reserva_sem_cobranca`) |
| 503 | `PAGAMENTO_INDISPONIVEL` | idem | Credencial do Mercado Pago não configurada (nenhuma reserva é criada) |

O app acompanha a confirmação lendo a própria reserva (polling simples, ver "Webhook" em pagamentos); o Realtime (`supabase.channel(...).on('postgres_changes', ...)`) fica para depois da AP2.

## pagamentos

| Tipo | Nome | Descrição |
|---|---|---|
| Edge Function 🔓 | `webhook-mercado-pago` | Notificação do Mercado Pago (`verify_jwt = false`; assinatura `x-signature` validada; order consultada na API) — idempotente (T23) |
| Tabela | `pagamento` — `select` | Status do pagamento das próprias reservas (RLS); só o passageiro, o motorista não vê |

Colunas de `pagamento`: `id_pagamento`, `id_reserva`, `id_externo`, `valor`, `taxa_plataforma`, `valor_repassado`, `metodo` (`PIX`), `status` (`PENDENTE`, `APROVADO`, `RECUSADO`, `REEMBOLSO_PENDENTE`), `pago_em`. Nenhuma escrita pelo app: o pagamento é criado pela Edge Function `reservar-vaga` e aprovado só pelo webhook (ADR-008).

**Webhook `webhook-mercado-pago` (T23).** Chamado só pelo Mercado Pago (evento *Order* configurado no painel), nunca pelo app:

```
POST /functions/v1/webhook-mercado-pago?data.id=ORDTST...&type=order
x-signature: ts=<segundos>,v1=<hmac sha256 hex>
x-request-id: <uuid>
{ "action": "order.processed", "type": "order", "data": { "id": "ORDTST..." , ... } }
```

1. Assinatura: manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (segmento ausente sai), HMAC-SHA256 com `MERCADO_PAGO_WEBHOOK_SECRET`, comparado em tempo constante com `v1`. O `data.id` vale em minúsculas (forma confirmada nas notificações reais) ou como veio na URL (tolerância). No sandbox, o segredo é o da aplicação do vendedor de teste (`docs/SECURITY.md`). O `ts` é obrigatório e entra no HMAC como veio, sem janela de tempo (`docs/SECURITY.md`). Inválida, ausente ou sem segredo → **401**, sem tocar no banco nem na API.
2. `type` diferente de `order` → 200 ignorado.
3. `GET /v1/orders/{id}` na API do Mercado Pago: a decisão usa a resposta da API, nunca o corpo da notificação. Erro de rede, timeout ou HTTP diferente de 200/400/404 (401, 403, 5xx) → **500** (o Mercado Pago reenvia a cada 15 min). Order 404 ou id recusado com 400 → 200 ignorado.
4. Só `status = processed` e `status_detail = accredited` é pago (tabela de status da documentação). Outros estados (`action_required`, `failed`, `canceled`, `refunded`…) → 200 sem mudar nada.
5. Order paga → `confirmar_pagamento(id da order, external_reference = id_pagamento, total_paid_amount)`.

Resposta 200: `{ "recebido": true, "resultado": "CONFIRMADO" }`. Resultados: `CONFIRMADO`, `JA_CONFIRMADO` (repetição), `REEMBOLSO_PENDENTE`, `IGNORADO_*` (tipo, order não encontrada, order inválida, não paga, sem referência) e `RECUSADO_<código>` (divergência de dados: 200 para não entrar em loop de retentativa; o log registra para conferência).

**Como o app (T25) sabe que a reserva foi confirmada:** polling pela RLS, `supabase.from('reserva').select('status, valor_individual, pagamento(status, valor)').eq('id_reserva', id)` (`consultarStatusReserva` em `services/reservas.ts`), a cada 5 s enquanto a tela de pagamento está em foco e a reserva está `PENDENTE`. Para ao sair da tela, quando a reserva vira `CONFIRMADA`, `CANCELADA` ou `EXPIRADA`, e depois de 15 min (botão "Verificar de novo"). O Pix (`qr_code`, `qr_code_base64`) não é salvo no banco: fica só na memória do app (`store/pix.ts`), indexado pelo `id_reserva`; reaberto o app, a tela mostra só o status. O Realtime fica para depois da AP2 (exige incluir `reserva` na publicação `supabase_realtime` por migration).

`parametro_custo` (preço do litro e taxa) não é exposta ao app: só funções SQL e Edge Functions a leem.

## notificacoes (US06)

| Tipo | Nome | Descrição |
|---|---|---|
| Tabela | `notificacao` — `select` | Do próprio usuário (RLS), mais recentes primeiro |
| RPC | `contar_notificacoes_nao_lidas()` → `integer` | Selo do sininho no Início (T29) |
| RPC | `marcar_notificacoes_lidas(p_ids uuid[] = null)` → `integer` | Marca as de `p_ids` (ou todas) como lidas; devolve quantas mudaram (T29) |
| Edge Function (interna, **futuro**) | `enviar-push` | Push pela Expo, adiado na T29 (no Android exige development build) |

**Notificações dentro do app (T29).** Os avisos são gravados pelo backend, por gatilhos nas mudanças
de status que as funções já fazem; o app não insere, não altera e não apaga linhas de `notificacao`
(só `select` das próprias). Quem recebe o quê:

| `tipo` | Para | Quando | Abre no app |
|---|---|---|---|
| `RESERVA_CONFIRMADA` | passageiro | o pagamento confirma a reserva | a reserva (`id_reserva`) |
| `NOVA_RESERVA` | motorista | o pagamento confirma a reserva de um passageiro | a carona (`id_carona`) |
| `CARONA_CANCELADA` | cada passageiro com reserva `PENDENTE` ou `CONFIRMADA` | o motorista cancela a carona | a reserva |
| `RESERVA_CANCELADA` | motorista | o passageiro cancela uma reserva **paga** (a pendente não avisa) | a carona |
| `AVALIACAO` | o avaliado | alguém o avalia | o Perfil (a própria média) |

A expiração de reserva não avisa ninguém. A `mensagem` vem pronta (até 300 caracteres), com o destino
curto e a data/hora de Brasília, ex.: "Bruna reservou uma vaga na sua carona para ULBRA Torres em 26/11
às 19:00.".

```ts
const { data: notificacoes } = await supabase
  .from('notificacao')
  .select('id_notificacao, tipo, mensagem, lida, criado_em, id_carona, id_reserva')
  .order('criado_em', { ascending: false })
  .limit(50);
const { data: naoLidas } = await supabase.rpc('contar_notificacoes_nao_lidas');
await supabase.rpc('marcar_notificacoes_lidas', { p_ids: ['uuid'] }); // ou sem p_ids: todas
```

Sem sessão, as duas RPCs → 401 `NAO_AUTENTICADO`; `anon` não lê a tabela nem executa as RPCs.

## avaliacoes

Conclusão da carona e avaliações (T30, RN07 e RN19). Prazos no banco: 1 dia depois da partida para o motorista concluir (`prazo_conclusao_carona()`) e 7 dias depois da partida para avaliar (`prazo_avaliacao()`). Depois de 1 dia, o job `concluir-caronas` (de hora em hora) conclui sozinho.

| Tipo | Nome | Descrição |
|---|---|---|
| RPC | `concluir_carona(p_id_carona)` → `integer` | O motorista conclui a própria carona |
| RPC | `avaliar_participante(p_id_reserva, p_nota, p_comentario = null)` → `uuid` | Avalia o outro lado da reserva (RN19) |
| RPC | `avaliacoes_pendentes()` | O que o usuário ainda pode avaliar |
| RPC | `perfil_publico(p_id_usuario)` | Nome, média e total de avaliações recebidas |
| Tabela | `avaliacao` — `select` | Só as avaliações que o usuário fez (RLS); escrita só pela `avaliar_participante` |

```ts
const { data: reservasConfirmadas } = await supabase.rpc('concluir_carona', { p_id_carona: 'uuid' });
const { data: idAvaliacao } = await supabase.rpc('avaliar_participante', {
  p_id_reserva: 'uuid', p_nota: 5, p_comentario: 'Pontual e simpático.', // comentário opcional
});
const { data: pendentes } = await supabase.rpc('avaliacoes_pendentes');
const { data: [perfil] } = await supabase.rpc('perfil_publico', { p_id_usuario: 'uuid' });
```

`concluir_carona(p_id_carona uuid) returns integer`:
- Só o motorista da carona (`auth.uid()`), com a carona `ABERTA`/`LOTADA`, de `data_hora_partida` até `data_hora_partida + 1 dia`.
- Só muda o status para `CONCLUIDA`; reservas e pagamentos ficam como estão. Devolve quantas reservas `CONFIRMADA` a carona tinha (quem poderá avaliar).

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão |
| 404 | `CARONA_NAO_ENCONTRADA` | Carona não encontrada. | Inexistente ou de outro motorista (mesma resposta) |
| 409 | `CARONA_JA_ENCERRADA` | Esta carona já foi concluída ou cancelada. | Status `CONCLUIDA` ou `CANCELADA` |
| 409 | `CARONA_NAO_PARTIU` | A carona só pode ser concluída depois do horário de partida. | Antes da partida |
| 409 | `CONCLUSAO_ENCERRADA` | O prazo para concluir esta carona era de 1 dia depois da partida. Ela é concluída automaticamente. | Mais de 1 dia depois da partida |

`avaliar_participante(p_id_reserva uuid, p_nota int, p_comentario text default null) returns uuid`:
- O avaliado é deduzido: o passageiro da reserva avalia o motorista; o motorista da carona avalia o passageiro. Ninguém mais avalia aquela reserva.
- Só com a reserva `CONFIRMADA` e a carona `CONCLUIDA`, até 7 dias depois da partida, uma vez por avaliador e reserva.
- `p_nota` inteira de 1 a 5 (fracionária é recusada pelo PostgREST antes, com `22P02`). `p_comentario` é aparado; vazio vira nulo; até 500 caracteres.

| HTTP | `message` (código) | `hint` | Quando |
|---|---|---|---|
| 401 | `NAO_AUTENTICADO` | Sua sessão expirou. Entre novamente. | Sem usuário na sessão |
| 422 | `NOTA_INVALIDA` | Escolha uma nota de 1 a 5. | Nota ausente ou fora de 1 a 5 |
| 400 | `DADOS_INVALIDOS` | O comentário pode ter até 500 caracteres. | Comentário com mais de 500 caracteres (depois de aparado) |
| 404 | `RESERVA_NAO_ENCONTRADA` | Reserva não encontrada. | Inexistente, ou o usuário não é o passageiro nem o motorista (mesma resposta) |
| 409 | `AVALIACAO_INDISPONIVEL` | A avaliação fica disponível depois que a carona é concluída, para reservas pagas. | Reserva não `CONFIRMADA` ou carona não `CONCLUIDA` |
| 409 | `PRAZO_AVALIACAO_ENCERRADO` | O prazo para avaliar esta carona era de 7 dias depois da partida. | Mais de 7 dias depois da partida |
| 409 | `AVALIACAO_DUPLICADA` | Você já avaliou esta carona. | Segunda avaliação da mesma reserva pelo mesmo avaliador |

`avaliacoes_pendentes() returns table (id_reserva, papel, nome_avaliado, origem, destino, data_hora_partida, avaliar_ate)`: as reservas que o usuário ainda pode avaliar (mesmas condições da `avaliar_participante`, sem avaliação dele), da partida mais recente para a mais antiga. `papel` é o de quem avalia (`PASSAGEIRO` avalia o motorista; `MOTORISTA` avalia o passageiro); `nome_avaliado` é só o primeiro nome; `avaliar_ate` = partida + 7 dias. Sem sessão → 401 `NAO_AUTENTICADO`.

`perfil_publico(p_id_usuario uuid) returns table (id_usuario, nome, media_avaliacoes, total_avaliacoes, foto_caminho)` (`foto_caminho` desde a T44: `'<id>/avatar.jpg?v=<época>'` ou nulo sem foto): perfil de qualquer usuário para quem está logado; `media_avaliacoes` com 1 casa (nula sem avaliações) e `total_avaliacoes` das avaliações **recebidas**. Sem e-mail, telefone nem gênero. Usuário inexistente → 404 `USUARIO_NAO_ENCONTRADO` ("Usuário não encontrado."); sem sessão → 401.

O `detalhar_carona` traz a mesma reputação do motorista em `media_motorista` e `total_avaliacoes_motorista`. Atenção: o `supabase gen types` tipa `media_motorista` e `media_avaliacoes` como `number`, mas elas vêm `null` para quem ainda não foi avaliado.

`anon` não executa nenhuma dessas funções nem lê `avaliacao`.
