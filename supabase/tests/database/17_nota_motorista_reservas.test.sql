-- T42 — minhas_reservas com a nota do motorista: media_motorista (1 casa, nula sem avaliações) e
-- total_avaliacoes_motorista no fim; o resto do contrato da T25 continua igual (colunas, ordem, só
-- as reservas do usuário); anon e sessão vazia recusados.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = Marcos (motorista, 2 avaliações: 5 e 4) · N = Nina (motorista, sem avaliações)
-- P = passageira com uma reserva em cada carona · Q e R = passageiros que avaliaram o Marcos
-- ------------------------------------------------------------

delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'm@teste.edu.br', '{"nome_completo": "Marcos Motorista"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br', '{"nome_completo": "Nina Silva"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br', '{"nome_completo": "Paula"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Quintino"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "Rita"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Onix', 'ABC1D23', 'Prata', 5),
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Gol', 'DEF4G56', 'Branco', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
values
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
   'ULBRA Torres - RS', -29.329, -49.7365, now() + interval '1 day', 3, 3, 24, 10),
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000e',
   'e1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
   'ULBRA Torres - RS', -29.329, -49.7365, now() + interval '2 days', 3, 3, 24, 10);

select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');

-- As avaliações recebidas pelo Marcos (a regra de quando avaliar é da T30; aqui só a conta)
insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota)
select r.id_reserva, r.id_passageiro, 'a0000000-0000-0000-0000-00000000000a', n.nota
from public.reserva r
join (values ('f0000000-0000-0000-0000-00000000000f'::uuid, 5), ('c0000000-0000-0000-0000-00000000000c'::uuid, 4))
  as n (id_passageiro, nota) using (id_passageiro)
where r.id_carona = '70000000-0000-0000-0000-000000000001';

create function public.teste_como(p_id_usuario uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id_usuario, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function public.teste_como(uuid) to authenticated;

-- ------------------------------------------------------------
-- Contrato: as colunas da T25 na mesma ordem, e as duas novas no fim
-- ------------------------------------------------------------

set local search_path = public, extensions;
select is(
  pg_get_function_result('public.minhas_reservas()'::regprocedure),
  'TABLE(id_reserva uuid, status_reserva status_reserva, reservado_em timestamp with time zone, '
    || 'status_pagamento status_pagamento, valor numeric, id_carona uuid, origem text, destino text, '
    || 'data_hora_partida timestamp with time zone, status_carona status_carona, nome_motorista text, '
    || 'media_motorista numeric, total_avaliacoes_motorista integer)',
  'mesmas colunas e ordem da T25, mais media_motorista e total_avaliacoes_motorista no fim (sem e-mail, telefone, gênero nem id do motorista)'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.minhas_reservas()'::regprocedure),
  'continua SECURITY DEFINER com search_path vazio'
);

-- ------------------------------------------------------------
-- Como P: só as reservas dela, com a nota de cada motorista
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('b0000000-0000-0000-0000-00000000000b');

select is(
  (select count(*)::int from public.minhas_reservas()),
  2,
  'só as reservas da usuária (as de Q e R na mesma carona não aparecem)'
);
select results_eq(
  $$select nome_motorista, media_motorista, total_avaliacoes_motorista
    from public.minhas_reservas()
    where id_carona = '70000000-0000-0000-0000-000000000001'$$,
  $$values ('Marcos'::text, 4.5::numeric, 2)$$,
  'motorista com 2 avaliações (5 e 4): média 4,5 e total 2'
);
select results_eq(
  $$select nome_motorista, media_motorista, total_avaliacoes_motorista
    from public.minhas_reservas()
    where id_carona = '70000000-0000-0000-0000-000000000002'$$,
  $$values ('Nina'::text, null::numeric, 0)$$,
  'motorista sem avaliações: média nula e total 0'
);
select results_eq(
  $$select status_reserva::text, status_pagamento::text, valor, status_carona::text
    from public.minhas_reservas() order by data_hora_partida$$,
  $$values ('PENDENTE', 'PENDENTE', 6.00::numeric, 'LOTADA'), ('PENDENTE', 'PENDENTE', 6.00::numeric, 'ABERTA')$$,
  'as colunas antigas continuam com os mesmos valores (c1 lotou com P, Q e R)'
);

-- ------------------------------------------------------------
-- Acesso
-- ------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select * from public.minhas_reservas()$$,
  'PT401', 'NAO_AUTENTICADO', 'sem auth.uid(): NAO_AUTENTICADO'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select * from public.minhas_reservas()$$,
  '42501', null, 'anon não executa minhas_reservas'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.minhas_reservas()', 'execute')
    and not has_function_privilege('public', 'public.minhas_reservas()', 'execute'),
  'authenticated executa; public não'
);

select * from finish();
rollback;
