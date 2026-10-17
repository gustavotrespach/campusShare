-- T23 — confirmar_pagamento: CONFIRMADO, JA_CONFIRMADO (idempotência), REEMBOLSO_PENDENTE (Pix pago
-- de reserva desfeita), caso raro sem id_externo, divergências, vagas intactas, acesso e leitura
-- pela RLS depois de confirmar.
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · P = b0...0b · Q = f0...0f · R = c0...0c
-- c1: 3 vagas · c2: 1 vaga (vai LOTADA e volta) · c3: 3 vagas
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br', '{"nome_completo": "M"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br', '{"nome_completo": "P"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Q"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "R"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
values
  ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro', -29.3353, -49.7268, 'ULBRA', -29.329,
   -49.7365, now() + interval '1 day', 3, 3, 24, 10),
  ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro', -29.3353, -49.7268, 'ULBRA', -29.329,
   -49.7365, now() + interval '1 day', 1, 1, 24, 10),
  ('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro', -29.3353, -49.7268, 'ULBRA', -29.329,
   -49.7365, now() + interval '1 day', 3, 3, 24, 10);

-- Reservas pela reservar_vaga (T21): R$ 24 com 3 vagas → R$ 6,00; com 1 vaga → R$ 12,00
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f');
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f');

create function public.teste_pagamento(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql
as $$
  select p.id_pagamento from public.pagamento p join public.reserva r using (id_reserva)
  where r.id_carona = p_id_carona and r.id_passageiro = p_id_passageiro
$$;
grant execute on function public.teste_pagamento to service_role;

-- Cobranças registradas pela T22 (P em c1 e P em c3); R em c1, Q em c2 e Q em c3 ficam sem
select public.registrar_cobranca(
  public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000000A'
);
select public.registrar_cobranca(
  public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000000D'
);
-- Q em c2: a cobrança "falhou" e a reserva foi desfeita (vaga devolvida)
select public.desfazer_reserva_sem_cobranca(
  (select id_reserva from public.reserva
   where id_carona = '40000000-0000-0000-0000-000000000002')
);

-- Vagas antes de qualquer confirmação (confirmar_pagamento não pode mudá-las)
create temporary table vagas_antes as
select id_carona, vagas_disponiveis, status from public.carona
where id_carona::text like '40000000-%';

-- ------------------------------------------------------------
-- Estrutura e acesso
-- ------------------------------------------------------------

select has_function(
  'public', 'confirmar_pagamento', array['text', 'uuid', 'numeric'], 'confirmar_pagamento existe'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.confirmar_pagamento'::regproc),
  'confirmar_pagamento é SECURITY DEFINER com search_path vazio'
);
select ok(
  has_function_privilege('service_role', 'public.confirmar_pagamento(text, uuid, numeric)', 'execute')
    and not has_function_privilege(
      'authenticated', 'public.confirmar_pagamento(text, uuid, numeric)', 'execute')
    and not has_function_privilege('anon', 'public.confirmar_pagamento(text, uuid, numeric)', 'execute'),
  'só a service_role executa confirmar_pagamento'
);

-- ------------------------------------------------------------
-- Como service_role (a Edge Function do webhook)
-- ------------------------------------------------------------

set local role service_role;

-- CONFIRMADO
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000A',
    public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
    6.00
  ),
  'CONFIRMADO',
  'order paga de reserva PENDENTE → CONFIRMADO'
);
select results_eq(
  $$select r.status::text, p.status::text, p.pago_em is not null
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '40000000-0000-0000-0000-000000000001'
      and r.id_passageiro = 'b0000000-0000-0000-0000-00000000000b'$$,
  $$values ('CONFIRMADA', 'APROVADO', true)$$,
  'reserva CONFIRMADA e pagamento APROVADO com pago_em'
);

-- JA_CONFIRMADO: a mesma notificação de novo não muda nada
select set_config(
  'teste.pago_em',
  (select p.pago_em::text from public.pagamento p
   where p.id_externo = 'ORDTST0000000000000000000000000A'),
  true
);
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000A',
    public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
    6.00
  ),
  'JA_CONFIRMADO',
  'notificação repetida → JA_CONFIRMADO'
);
select is(
  (select p.pago_em::text from public.pagamento p
   where p.id_externo = 'ORDTST0000000000000000000000000A'),
  current_setting('teste.pago_em'),
  'a repetição não altera pago_em'
);

-- REEMBOLSO_PENDENTE: Pix pago de reserva desfeita (caso raro da T22, sem id_externo)
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000B',
    public.teste_pagamento('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f'),
    12.00
  ),
  'REEMBOLSO_PENDENTE',
  'Pix pago de reserva CANCELADA → REEMBOLSO_PENDENTE'
);
select results_eq(
  $$select r.status::text, p.status::text, p.id_externo::text, p.pago_em is not null
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '40000000-0000-0000-0000-000000000002'$$,
  $$values ('CANCELADA', 'REEMBOLSO_PENDENTE', 'ORDTST0000000000000000000000000B', true)$$,
  'reserva continua CANCELADA; pagamento para reembolso, com a order gravada pelo external_reference'
);
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000B',
    public.teste_pagamento('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f'),
    12.00
  ),
  'REEMBOLSO_PENDENTE',
  'repetição do reembolso também é idempotente'
);

-- Caso raro com a reserva ainda PENDENTE: id_externo nulo, aceito pelo external_reference
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000C',
    public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c'),
    6.00
  ),
  'CONFIRMADO',
  'pagamento sem id_externo é confirmado pelo external_reference'
);
select results_eq(
  $$select r.status::text, p.status::text, p.id_externo::text
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '40000000-0000-0000-0000-000000000001'
      and r.id_passageiro = 'c0000000-0000-0000-0000-00000000000c'$$,
  $$values ('CONFIRMADA', 'APROVADO', 'ORDTST0000000000000000000000000C')$$,
  'e a order fica gravada no pagamento'
);

-- Divergências: nada muda
select throws_ok(
  $$select public.confirmar_pagamento(
      'ORDTST000000000000000000000000XX',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
      6.00)$$,
  'PT409', 'COBRANCA_DIVERGENTE', 'order diferente da registrada no pagamento é recusada'
);
select throws_ok(
  $$select public.confirmar_pagamento(
      'ORDTST0000000000000000000000000D',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
      6.01)$$,
  'PT409', 'VALOR_DIVERGENTE', 'valor pago diferente do valor da reserva é recusado'
);
select throws_ok(
  $$select public.confirmar_pagamento(
      'ORDTST0000000000000000000000000A',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f'),
      6.00)$$,
  'PT409', 'COBRANCA_DUPLICADA', 'order que já pertence a outro pagamento é recusada'
);
select results_eq(
  $$select r.status::text, p.status::text
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '40000000-0000-0000-0000-000000000003'
    order by r.id_passageiro$$,
  $$values ('PENDENTE', 'PENDENTE'), ('PENDENTE', 'PENDENTE')$$,
  'depois das divergências, as reservas de c3 continuam PENDENTE'
);
select is(
  (select id_externo from public.pagamento
   where id_pagamento = public.teste_pagamento(
     '40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f')),
  null,
  'a order duplicada não foi gravada'
);
select throws_ok(
  $$select public.confirmar_pagamento('ORDTST1', '99999999-0000-0000-0000-000000000000', 6.00)$$,
  'PT404', 'PAGAMENTO_NAO_ENCONTRADO', 'external_reference sem pagamento'
);
select throws_ok(
  $$select public.confirmar_pagamento(
      '  ',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
      6.00)$$,
  'PT400', 'DADOS_INVALIDOS', 'id da order vazio'
);
select throws_ok(
  $$select public.confirmar_pagamento(
      'ORDTST0000000000000000000000000D',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
      0)$$,
  'PT400', 'DADOS_INVALIDOS', 'valor zero'
);

-- Pagamento RECUSADO com reserva desfeita, pago de novo: continua só o reembolso
select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000000B',
    public.teste_pagamento('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f'),
    12.00
  ),
  'REEMBOLSO_PENDENTE',
  'reserva desfeita nunca vira CONFIRMADA'
);

-- ------------------------------------------------------------
-- Leitura pela RLS depois de confirmar
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}',
  true
);
select results_eq(
  $$select r.status::text, p.status::text
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '40000000-0000-0000-0000-000000000001'$$,
  $$values ('CONFIRMADA', 'APROVADO')$$,
  'o passageiro lê a própria reserva CONFIRMADA e o pagamento APROVADO'
);
select throws_ok(
  $$select public.confirmar_pagamento(
      'ORDTST0000000000000000000000000D',
      public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
      6.00)$$,
  '42501', null, 'authenticated não confirma o próprio pagamento (só o webhook, ADR-008)'
);
select throws_ok(
  $$update public.reserva set status = 'CONFIRMADA'
    where id_carona = '40000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'nem pela tabela'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.reserva
   where id_carona = '40000000-0000-0000-0000-000000000001' and status = 'CONFIRMADA'),
  2::bigint,
  'o motorista vê as duas reservas confirmadas da carona'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select public.confirmar_pagamento('ORDTST1', '99999999-0000-0000-0000-000000000000', 6.00)$$,
  '42501', null, 'anon não executa confirmar_pagamento'
);

-- ------------------------------------------------------------
-- Estados finais (como postgres)
-- ------------------------------------------------------------

reset role;
-- Vagas intactas em todos os casos
select results_eq(
  $$select id_carona, vagas_disponiveis, status from public.carona
    where id_carona::text like '40000000-%' order by id_carona$$,
  $$select id_carona, vagas_disponiveis, status from vagas_antes order by id_carona$$,
  'confirmar_pagamento não mexe em vagas nem no status das caronas'
);
select results_eq(
  $$select vagas_disponiveis::int, status::text from public.carona
    where id_carona = '40000000-0000-0000-0000-000000000002'$$,
  $$values (1, 'ABERTA')$$,
  'a vaga devolvida na reserva desfeita continua livre depois do reembolso'
);

select results_eq(
  $$select r.id_passageiro, r.status::text, p.status::text
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona::text like '40000000-%'
    order by r.id_carona, r.id_passageiro$$,
  $$values
    ('b0000000-0000-0000-0000-00000000000b'::uuid, 'CONFIRMADA', 'APROVADO'),
    ('c0000000-0000-0000-0000-00000000000c'::uuid, 'CONFIRMADA', 'APROVADO'),
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 'CANCELADA', 'REEMBOLSO_PENDENTE'),
    ('b0000000-0000-0000-0000-00000000000b'::uuid, 'PENDENTE', 'PENDENTE'),
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 'PENDENTE', 'PENDENTE')$$,
  'estado final de todas as reservas do teste'
);
select is(
  (select count(*) from public.pagamento p join public.reserva r using (id_reserva)
   where r.id_carona::text like '40000000-%' and p.status = 'APROVADO' and r.status <> 'CONFIRMADA'),
  0::bigint,
  'nenhum pagamento APROVADO sem a reserva CONFIRMADA'
);
select is(
  (select count(*) from public.pagamento p join public.reserva r using (id_reserva)
   where r.id_carona::text like '40000000-%' and r.status = 'CONFIRMADA' and p.status <> 'APROVADO'),
  0::bigint,
  'nenhuma reserva CONFIRMADA sem pagamento APROVADO'
);

select * from finish();
rollback;
