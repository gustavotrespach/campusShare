-- T20 — RESERVA, PAGAMENTO e PARAMETRO_CUSTO: estrutura, CHECKs, reserva dupla, RLS só de leitura
-- para os participantes, dado inicial e exclusão de conta em cascata (com o trigger da T15).
begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · O = outro motorista e0...0e · P = passageiro b0...0b · T = terceiro c0...0c
-- Caronas: CM (a2...01, de M) e CO (e2...01, de O). P reservou nas duas (R1 em CM, R2 em CO),
-- cada reserva com um pagamento (G1, G2). T não participa de nada.
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br',
   '{"nome_completo": "Motorista M"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'outro.motorista@teste.edu.br',
   '{"nome_completo": "Motorista O"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'passageiro@teste.edu.br',
   '{"nome_completo": "Passageiro P"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'terceiro@teste.edu.br',
   '{"nome_completo": "Terceiro T"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'AAA1A11', 'Prata', 5),
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e',
   'Gol', 'EEE1E11', 'Branco', 5);

create function pg_temp.inserir_carona(
  p_id_carona uuid,
  p_id_motorista uuid,
  p_id_veiculo uuid,
  p_vagas_ofertadas smallint default 3,
  p_vagas_disponiveis smallint default 3
) returns void
language sql
as $$
  insert into public.carona (
    id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
    destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
  ) values (
    p_id_carona, p_id_motorista, p_id_veiculo,
    'Centro, Torres', -29.335, -49.727, 'ULBRA Torres', -29.330, -49.740,
    now() + interval '1 day', p_vagas_ofertadas, p_vagas_disponiveis, 24, 10
  );
$$;

select pg_temp.inserir_carona(
  'a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
  'a1000000-0000-0000-0000-000000000001'
);
select pg_temp.inserir_carona(
  'e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e',
  'e1000000-0000-0000-0000-000000000001'
);

insert into public.reserva (id_reserva, id_carona, id_passageiro, valor_individual)
values
  ('b3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-00000000000b', 6.00),
  ('b3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-00000000000b', 6.00);

insert into public.pagamento (
  id_pagamento, id_reserva, id_externo, valor, taxa_plataforma, valor_repassado
)
values
  ('b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'mp-1',
   6.00, 0.60, 5.40),
  ('b4000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000002', 'mp-2',
   6.00, 0.60, 5.40);

-- ------------------------------------------------------------
-- Estrutura
-- ------------------------------------------------------------

select has_table('public', 'reserva', 'tabela reserva existe');
select has_table('public', 'pagamento', 'tabela pagamento existe');
select has_table('public', 'parametro_custo', 'tabela parametro_custo existe');
select enum_has_labels(
  'public', 'status_reserva', array['PENDENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA'],
  'enum status_reserva'
);
select enum_has_labels(
  'public', 'status_pagamento', array['PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSO_PENDENTE'],
  'enum status_pagamento'
);
select enum_has_labels('public', 'metodo_pagamento', array['PIX'], 'enum metodo_pagamento');
select col_not_null('public', 'carona', 'vagas_ofertadas', 'carona.vagas_ofertadas é obrigatória');
select fk_ok(
  'public', 'reserva', 'id_carona', 'public', 'carona', 'id_carona', 'reserva → carona'
);
select fk_ok(
  'public', 'reserva', 'id_passageiro', 'public', 'usuario', 'id_usuario', 'reserva → usuario'
);
select fk_ok(
  'public', 'pagamento', 'id_reserva', 'public', 'reserva', 'id_reserva', 'pagamento → reserva'
);
select col_is_unique('public', 'pagamento', 'id_reserva', 'pagamento é 1:1 com reserva');
select results_eq(
  $$select (conrelid::regclass::text || '.' || a.attname) collate "default"
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confdeltype = 'c'
      and c.conrelid in ('public.reserva'::regclass, 'public.pagamento'::regclass)
    order by 1$$,
  $$values ('pagamento.id_reserva'), ('reserva.id_carona'), ('reserva.id_passageiro')$$,
  'FKs de reserva e pagamento apagam em cascata (exclusão de conta)'
);
select is(
  (select count(*) from pg_class
   where oid in ('public.reserva'::regclass, 'public.pagamento'::regclass,
                 'public.parametro_custo'::regclass)
     and relrowsecurity),
  3::bigint,
  'RLS habilitada nas três tabelas'
);

-- ------------------------------------------------------------
-- CHECKs
-- ------------------------------------------------------------

select throws_ok(
  $$select pg_temp.inserir_carona(gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a',
      'a1000000-0000-0000-0000-000000000001', 0::smallint, 0::smallint)$$,
  '23514', null, 'vagas_ofertadas = 0 é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a',
      'a1000000-0000-0000-0000-000000000001', 8::smallint, 3::smallint)$$,
  '23514', null, 'vagas_ofertadas = 8 é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a',
      'a1000000-0000-0000-0000-000000000001', 3::smallint, 4::smallint)$$,
  '23514', null, 'vagas_disponiveis acima de vagas_ofertadas é recusada'
);
select lives_ok(
  $$select pg_temp.inserir_carona(gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a',
      'a1000000-0000-0000-0000-000000000001', 3::smallint, 0::smallint)$$,
  'carona LOTADA (0 de 3 vagas) é aceita'
);
select throws_ok(
  $$insert into public.reserva (id_carona, id_passageiro, valor_individual)
    values ('a2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 0)$$,
  '23514', null, 'valor_individual = 0 é recusado'
);
select throws_ok(
  $$update public.pagamento set valor_repassado = 6.00
    where id_pagamento = 'b4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'valor_repassado diferente de valor − taxa é recusado'
);
select throws_ok(
  $$update public.pagamento set taxa_plataforma = 6.01, valor_repassado = -0.01
    where id_pagamento = 'b4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'taxa_plataforma acima do valor é recusada'
);
select throws_ok(
  $$update public.pagamento set status = 'APROVADO'
    where id_pagamento = 'b4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'pagamento APROVADO sem pago_em é recusado'
);
select lives_ok(
  $$update public.pagamento set status = 'APROVADO', pago_em = now()
    where id_pagamento = 'b4000000-0000-0000-0000-000000000001'$$,
  'pagamento APROVADO com pago_em é aceito'
);
select throws_ok(
  $$update public.pagamento set id_externo = 'mp-1'
    where id_pagamento = 'b4000000-0000-0000-0000-000000000002'$$,
  '23505', null, 'id_externo duplicado é recusado (idempotência do webhook)'
);
select throws_ok(
  $$insert into public.pagamento (id_reserva, valor, taxa_plataforma, valor_repassado)
    values ('b3000000-0000-0000-0000-000000000001', 6.00, 0.60, 5.40)$$,
  '23505', null, 'segundo pagamento para a mesma reserva é recusado'
);
select throws_ok(
  $$insert into public.parametro_custo (preco_litro, percentual_taxa) values (6.29, 1.5)$$,
  '23514', null, 'percentual_taxa acima de 1 é recusado'
);

-- ------------------------------------------------------------
-- Dado inicial (migration idempotente)
-- ------------------------------------------------------------

select results_eq(
  $$select preco_litro, percentual_taxa from public.parametro_custo$$,
  $$values (6.29::decimal(5, 2), 0.1000::decimal(5, 4))$$,
  'parametro_custo tem exatamente 1 linha: 6.29 e 0.1000'
);
-- O mesmo insert da migration, rodado de novo, não duplica
insert into public.parametro_custo (preco_litro, percentual_taxa)
select 6.29, 0.1000
where not exists (select 1 from public.parametro_custo);
select is(
  (select count(*) from public.parametro_custo),
  1::bigint,
  'insert inicial é idempotente'
);

-- ------------------------------------------------------------
-- RLS: leitura pelos participantes
-- ------------------------------------------------------------

set local role authenticated;

-- Passageiro
select set_config(
  'request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}',
  true
);
select results_eq(
  $$select id_reserva from public.reserva order by 1$$,
  $$values ('b3000000-0000-0000-0000-000000000001'::uuid),
           ('b3000000-0000-0000-0000-000000000002'::uuid)$$,
  'passageiro lê as próprias reservas'
);
select results_eq(
  $$select id_pagamento from public.pagamento order by 1$$,
  $$values ('b4000000-0000-0000-0000-000000000001'::uuid),
           ('b4000000-0000-0000-0000-000000000002'::uuid)$$,
  'passageiro lê os pagamentos das próprias reservas'
);

-- Escrita negada (como o passageiro, dono das linhas)
select throws_ok(
  $$insert into public.reserva (id_carona, id_passageiro, valor_individual)
    values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 1)$$,
  '42501', null, 'authenticated não insere reserva'
);
select throws_ok(
  $$update public.reserva set status = 'CONFIRMADA'
    where id_reserva = 'b3000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated não confirma a própria reserva (só o webhook, ADR-008)'
);
select throws_ok(
  $$delete from public.reserva where id_reserva = 'b3000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated não exclui reserva'
);
select throws_ok(
  $$insert into public.pagamento (id_reserva, valor, taxa_plataforma, valor_repassado)
    values ('b3000000-0000-0000-0000-000000000002', 1, 0, 1)$$,
  '42501', null, 'authenticated não insere pagamento'
);
select throws_ok(
  $$update public.pagamento set status = 'APROVADO', pago_em = now()
    where id_pagamento = 'b4000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'authenticated não aprova o próprio pagamento'
);
select throws_ok(
  $$delete from public.pagamento where id_pagamento = 'b4000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'authenticated não exclui pagamento'
);
select throws_ok(
  $$select 1 from public.parametro_custo$$,
  '42501', null, 'authenticated não lê parametro_custo'
);

-- Motorista M: só as reservas da própria carona, sem os pagamentos
select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);
select results_eq(
  $$select id_reserva from public.reserva$$,
  $$values ('b3000000-0000-0000-0000-000000000001'::uuid)$$,
  'motorista lê as reservas das próprias caronas, e não as de outro motorista'
);
select is_empty(
  $$select 1 from public.pagamento$$,
  'motorista não lê os pagamentos dos passageiros'
);

-- Outro motorista O
select set_config(
  'request.jwt.claims',
  '{"sub": "e0000000-0000-0000-0000-00000000000e", "role": "authenticated"}',
  true
);
select results_eq(
  $$select id_reserva from public.reserva$$,
  $$values ('b3000000-0000-0000-0000-000000000002'::uuid)$$,
  'outro motorista lê só a reserva da carona dele'
);

-- Terceiro T
select set_config(
  'request.jwt.claims',
  '{"sub": "c0000000-0000-0000-0000-00000000000c", "role": "authenticated"}',
  true
);
select is_empty($$select 1 from public.reserva$$, 'terceiro não lê nenhuma reserva');
select is_empty($$select 1 from public.pagamento$$, 'terceiro não lê nenhum pagamento');

-- ------------------------------------------------------------
-- anon: nenhum acesso
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$select 1 from public.reserva$$, '42501', null, 'anon não lê reserva');
select throws_ok($$select 1 from public.pagamento$$, '42501', null, 'anon não lê pagamento');
select throws_ok(
  $$select 1 from public.parametro_custo$$, '42501', null, 'anon não lê parametro_custo'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.reserva', 'INSERT, UPDATE, DELETE')
    and not has_table_privilege('anon', 'public.pagamento', 'INSERT, UPDATE, DELETE')
    and not has_table_privilege('anon', 'public.parametro_custo', 'INSERT, UPDATE, DELETE'),
  'anon não tem privilégio de escrita nas três tabelas'
);

-- ------------------------------------------------------------
-- Reserva dupla (RN14): uma ativa por passageiro por carona
-- ------------------------------------------------------------

select throws_ok(
  $$insert into public.reserva (id_carona, id_passageiro, valor_individual)
    values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 6)$$,
  '23505', null, 'segunda reserva com a PENDENTE ativa é recusada'
);
update public.reserva set status = 'CONFIRMADA'
where id_reserva = 'b3000000-0000-0000-0000-000000000001';
select throws_ok(
  $$insert into public.reserva (id_carona, id_passageiro, valor_individual)
    values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 6)$$,
  '23505', null, 'segunda reserva com a CONFIRMADA ativa é recusada'
);
update public.reserva set status = 'CANCELADA'
where id_reserva = 'b3000000-0000-0000-0000-000000000001';
select lives_ok(
  $$insert into public.reserva (id_carona, id_passageiro, valor_individual)
    values ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 6)$$,
  'nova reserva depois de uma CANCELADA é aceita'
);

-- ------------------------------------------------------------
-- Exclusão de conta em cascata (como postgres)
-- ------------------------------------------------------------

-- Passageiro: leva as reservas e os pagamentos dele
select lives_ok(
  $$delete from auth.users where id = 'b0000000-0000-0000-0000-00000000000b'$$,
  'conta do passageiro com reservas e pagamentos pode ser excluída'
);
select is(
  (select count(*) from public.reserva
   where id_passageiro = 'b0000000-0000-0000-0000-00000000000b'),
  0::bigint,
  'a cascata removeu as reservas do passageiro'
);
select is(
  (select count(*) from public.pagamento
   where id_pagamento in ('b4000000-0000-0000-0000-000000000001',
                          'b4000000-0000-0000-0000-000000000002')),
  0::bigint,
  'a cascata removeu os pagamentos do passageiro'
);

-- Motorista: com a carona ainda ABERTA e reservada por T, o trigger da T15 não pode travar
insert into public.reserva (id_reserva, id_carona, id_passageiro, valor_individual)
values ('c3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-00000000000c', 6.00);
insert into public.pagamento (id_reserva, valor, taxa_plataforma, valor_repassado)
values ('c3000000-0000-0000-0000-000000000001', 6.00, 0.60, 5.40);

select lives_ok(
  $$delete from auth.users where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'conta do motorista com carona ABERTA reservada pode ser excluída'
);
select is(
  (select count(*) from public.carona
   where id_motorista = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'a cascata removeu as caronas do motorista'
);
select is(
  (select count(*) from public.reserva
   where id_reserva = 'c3000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a cascata removeu as reservas da carona do motorista'
);
select is(
  (select count(*) from public.pagamento
   where id_reserva = 'c3000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a cascata removeu o pagamento da reserva na carona do motorista'
);

select * from finish();
rollback;
