-- T25 — minhas_reservas: cada usuário vê só as próprias reservas, mais recentes primeiro, com o
-- status do pagamento, o valor e as colunas públicas da carona; anon não executa.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · P e R = passageiros · Q = sem reservas
-- c1 e c2: custo 24, 3 vagas → R$ 6,00 por passageiro (motorista entra no rateio)
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br',
   '{"nome_completo": "  Marcos Motorista Silva"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'passageiro@teste.edu.br',
   '{"nome_completo": "Passageiro P"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'outro@teste.edu.br',
   '{"nome_completo": "Passageiro R"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'semreserva@teste.edu.br',
   '{"nome_completo": "Sem Reserva Q"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
values
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro, Torres', -29.3353, -49.7268,
   'ULBRA Torres', -29.329, -49.7365, '2030-01-10 12:00:00+00', 3, 3, 24, 10),
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Rodoviária de Torres', -29.3385, -49.7355,
   'ULBRA Torres', -29.329, -49.7365, '2030-01-11 22:30:00+00', 3, 3, 24, 10);

-- Reservas pela própria reservar_vaga (T21): reserva e pagamento PENDENTE
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'
);
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b'
);
select * from public.reservar_vaga(
  '30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c'
);

-- now() é o mesmo na transação: datas fixas para conferir a ordem
update public.reserva set criado_em = '2029-12-01 10:00:00+00'
where id_carona = '30000000-0000-0000-0000-000000000001';
update public.reserva set criado_em = '2029-12-02 10:00:00+00'
where id_carona = '30000000-0000-0000-0000-000000000002';

-- A reserva de P em c1 foi paga (como o webhook deixaria)
update public.pagamento set status = 'APROVADO', pago_em = now()
where id_reserva = (
  select id_reserva from public.reserva
  where id_carona = '30000000-0000-0000-0000-000000000001'
    and id_passageiro = 'b0000000-0000-0000-0000-00000000000b'
);
update public.reserva set status = 'CONFIRMADA'
where id_carona = '30000000-0000-0000-0000-000000000001'
  and id_passageiro = 'b0000000-0000-0000-0000-00000000000b';

create function public.teste_como(p_id_usuario uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id_usuario, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function public.teste_como to authenticated, anon;

-- ------------------------------------------------------------
-- Estrutura e acesso
-- ------------------------------------------------------------

select has_function('public', 'minhas_reservas', array[]::text[], 'minhas_reservas existe');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.minhas_reservas'::regproc),
  'SECURITY DEFINER com search_path vazio'
);
select ok(
  has_function_privilege('authenticated', 'public.minhas_reservas()', 'execute')
    and not has_function_privilege('anon', 'public.minhas_reservas()', 'execute')
    and not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'minhas_reservas'
        and grantee = 'PUBLIC'
    ),
  'authenticated executa; anon e public não'
);

-- ------------------------------------------------------------
-- Como P: as duas reservas dele, a mais recente primeiro, com os valores
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  $$select id_carona, status_reserva::text, reservado_em, status_pagamento::text, valor,
      origem, destino, data_hora_partida, status_carona::text, nome_motorista
    from public.minhas_reservas()$$,
  $$values
    ('30000000-0000-0000-0000-000000000002'::uuid, 'PENDENTE', '2029-12-02 10:00:00+00'::timestamptz,
     'PENDENTE', 6.00::numeric, 'Rodoviária de Torres', 'ULBRA Torres',
     '2030-01-11 22:30:00+00'::timestamptz, 'ABERTA', 'Marcos'),
    ('30000000-0000-0000-0000-000000000001'::uuid, 'CONFIRMADA', '2029-12-01 10:00:00+00'::timestamptz,
     'APROVADO', 6.00::numeric, 'Centro, Torres', 'ULBRA Torres',
     '2030-01-10 12:00:00+00'::timestamptz, 'ABERTA', 'Marcos')$$,
  'P vê as próprias reservas, mais recentes primeiro, com pagamento, valor e carona'
);
select is(
  (select count(*)::int from public.minhas_reservas() m
   join public.reserva r using (id_reserva)),
  2,
  'os id_reserva devolvidos são as reservas de P (P lê as próprias pela RLS)'
);

-- ------------------------------------------------------------
-- Como R e como Q
-- ------------------------------------------------------------

select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select id_carona, status_reserva::text, status_pagamento::text
    from public.minhas_reservas()$$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid, 'PENDENTE', 'PENDENTE')$$,
  'R vê só a própria reserva na mesma carona, não a de P'
);

select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select is_empty(
  $$select * from public.minhas_reservas()$$,
  'quem não tem reserva recebe lista vazia'
);

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select * from public.minhas_reservas()$$,
  'PT401', 'NAO_AUTENTICADO', 'sem usuário no JWT é recusado'
);

-- ------------------------------------------------------------
-- anon
-- ------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select * from public.minhas_reservas()$$,
  '42501', null, 'anon não executa'
);

select * from finish();
rollback;
