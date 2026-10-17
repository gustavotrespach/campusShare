-- T22 — registrar_cobranca e desfazer_reserva_sem_cobranca: gravação idempotente do id da order,
-- recusa de id divergente, devolução da vaga quando a cobrança falha (LOTADA volta a ABERTA),
-- casos em que não age e acesso só da service_role.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · P = passageiro b0...0b · Q = passageira f0...0f
-- c1, c2 e c3: 1 vaga cada (a reserva deixa a carona LOTADA)
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br',
   '{"nome_completo": "Motorista M"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'passageiro@teste.edu.br',
   '{"nome_completo": "Passageiro P"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'passageira@teste.edu.br',
   '{"nome_completo": "Passageira Q", "genero": "FEMININO"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
select id, 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
  'Centro, Torres', -29.3353, -49.7268, 'ULBRA Torres', -29.329, -49.7365,
  now() + interval '1 day', 1, 1, 24, 10
from unnest(array[
  '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003'
]::uuid[]) as id;

-- Reservas criadas pela própria reservar_vaga (T21), com pagamento PENDENTE e id_externo nulo
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'
);
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f'
);
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'
);

create function public.teste_reserva(p_id_carona uuid) returns uuid
language sql
as $$ select r.id_reserva from public.reserva r where r.id_carona = p_id_carona $$;

create function public.teste_pagamento(p_id_carona uuid) returns uuid
language sql
as $$
  select p.id_pagamento from public.pagamento p
  join public.reserva r using (id_reserva)
  where r.id_carona = p_id_carona
$$;

grant execute on function public.teste_reserva, public.teste_pagamento to service_role;

-- ------------------------------------------------------------
-- Estrutura e acesso
-- ------------------------------------------------------------

select has_function('public', 'registrar_cobranca', array['uuid', 'text'], 'registrar_cobranca existe');
select has_function(
  'public', 'desfazer_reserva_sem_cobranca', array['uuid'], 'desfazer_reserva_sem_cobranca existe'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.registrar_cobranca'::regproc,
                 'public.desfazer_reserva_sem_cobranca'::regproc)),
  'as duas são SECURITY DEFINER com search_path vazio'
);
select ok(
  has_function_privilege('service_role', 'public.registrar_cobranca(uuid, text)', 'execute')
    and has_function_privilege(
      'service_role', 'public.desfazer_reserva_sem_cobranca(uuid)', 'execute')
    and not has_function_privilege(
      'authenticated', 'public.registrar_cobranca(uuid, text)', 'execute')
    and not has_function_privilege(
      'authenticated', 'public.desfazer_reserva_sem_cobranca(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.registrar_cobranca(uuid, text)', 'execute')
    and not has_function_privilege(
      'anon', 'public.desfazer_reserva_sem_cobranca(uuid)', 'execute'),
  'só a service_role executa as duas'
);

-- ------------------------------------------------------------
-- registrar_cobranca (como service_role)
-- ------------------------------------------------------------

set local role service_role;

select lives_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000001'), 'ORD01TESTE00001')$$,
  'grava o id da order no pagamento PENDENTE'
);
select is(
  (select id_externo::text from public.pagamento
   where id_pagamento = public.teste_pagamento('30000000-0000-0000-0000-000000000001')),
  'ORD01TESTE00001',
  'id_externo gravado'
);
select lives_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000001'), 'ORD01TESTE00001')$$,
  'repetir o mesmo id é idempotente'
);
select throws_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000001'), 'ORD01OUTRA00002')$$,
  'PT409', 'COBRANCA_DIVERGENTE', 'id diferente num pagamento que já tem cobrança é recusado'
);
select throws_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000003'), 'ORD01TESTE00001')$$,
  'PT409', 'COBRANCA_DUPLICADA', 'a mesma order não pode ir para outro pagamento'
);
select throws_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000003'), '   ')$$,
  'PT400', 'DADOS_INVALIDOS', 'id vazio é recusado'
);
select throws_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000003'), repeat('x', 65))$$,
  'PT400', 'DADOS_INVALIDOS', 'id maior que a coluna (64) é recusado'
);
select throws_ok(
  $$select public.registrar_cobranca('99999999-0000-0000-0000-000000000000', 'ORD01X')$$,
  'PT404', 'PAGAMENTO_NAO_ENCONTRADO', 'pagamento inexistente'
);

-- ------------------------------------------------------------
-- desfazer_reserva_sem_cobranca (como service_role)
-- ------------------------------------------------------------

select results_eq(
  $$select vagas_disponiveis::int, status::text from public.carona
    where id_carona = '30000000-0000-0000-0000-000000000002'$$,
  $$values (0, 'LOTADA')$$,
  'antes: a reserva de Q deixou a carona c2 LOTADA'
);
select is(
  public.desfazer_reserva_sem_cobranca(public.teste_reserva('30000000-0000-0000-0000-000000000002')),
  true,
  'cobrança falhou: a reserva sem id_externo é desfeita'
);
select results_eq(
  $$select r.status::text, p.status::text
    from public.reserva r join public.pagamento p using (id_reserva)
    where r.id_carona = '30000000-0000-0000-0000-000000000002'$$,
  $$values ('CANCELADA', 'RECUSADO')$$,
  'reserva CANCELADA e pagamento RECUSADO'
);
select results_eq(
  $$select vagas_disponiveis::int, status::text from public.carona
    where id_carona = '30000000-0000-0000-0000-000000000002'$$,
  $$values (1, 'ABERTA')$$,
  'a vaga volta e a carona LOTADA volta a ABERTA'
);
select is(
  public.desfazer_reserva_sem_cobranca(public.teste_reserva('30000000-0000-0000-0000-000000000002')),
  false,
  'chamar de novo não faz nada (idempotente)'
);
select results_eq(
  $$select vagas_disponiveis::int from public.carona
    where id_carona = '30000000-0000-0000-0000-000000000002'$$,
  $$values (1)$$,
  'a segunda chamada não devolve vaga a mais'
);
select throws_ok(
  $$select public.registrar_cobranca(
      public.teste_pagamento('30000000-0000-0000-0000-000000000002'), 'ORD01TARDE00003')$$,
  'PT409', 'PAGAMENTO_ENCERRADO', 'pagamento RECUSADO não recebe cobrança depois'
);
select lives_ok(
  $$select * from public.reservar_vaga('30000000-0000-0000-0000-000000000002',
                                       'f0000000-0000-0000-0000-00000000000f')$$,
  'depois de desfeita, a passageira pode reservar de novo'
);

-- Não age em reserva com cobrança criada
select is(
  public.desfazer_reserva_sem_cobranca(public.teste_reserva('30000000-0000-0000-0000-000000000001')),
  false,
  'reserva com id_externo não é desfeita'
);
select results_eq(
  $$select r.status::text, c.vagas_disponiveis::int, c.status::text
    from public.reserva r join public.carona c using (id_carona)
    where r.id_carona = '30000000-0000-0000-0000-000000000001'$$,
  $$values ('PENDENTE', 0, 'LOTADA')$$,
  'a reserva com cobrança continua PENDENTE e a vaga continua ocupada'
);

-- Não age em reserva confirmada
reset role;
update public.reserva set status = 'CONFIRMADA'
where id_reserva = public.teste_reserva('30000000-0000-0000-0000-000000000003');
set local role service_role;
select is(
  public.desfazer_reserva_sem_cobranca(public.teste_reserva('30000000-0000-0000-0000-000000000003')),
  false,
  'reserva CONFIRMADA não é desfeita'
);
select is(
  public.desfazer_reserva_sem_cobranca('99999999-0000-0000-0000-000000000000'),
  false,
  'reserva inexistente: nada a fazer'
);

-- ------------------------------------------------------------
-- O app não chama as funções
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}',
  true
);
select throws_ok(
  $$select public.registrar_cobranca('99999999-0000-0000-0000-000000000000', 'ORD01X')$$,
  '42501', null, 'authenticated não executa registrar_cobranca'
);
select throws_ok(
  $$select public.desfazer_reserva_sem_cobranca('99999999-0000-0000-0000-000000000000')$$,
  '42501', null, 'authenticated não executa desfazer_reserva_sem_cobranca'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select public.registrar_cobranca('99999999-0000-0000-0000-000000000000', 'ORD01X')$$,
  '42501', null, 'anon não executa registrar_cobranca'
);

select * from finish();
rollback;
