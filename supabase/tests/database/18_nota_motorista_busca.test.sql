-- T43 — buscar_caronas com a nota do motorista: media_motorista (1 casa, nula sem avaliações) e
-- total_avaliacoes_motorista no fim; o resto do contrato da T18 continua igual (parâmetros, colunas,
-- filtros RN14/RN18, ordem, paginação, erros e grants); anon e sessão vazia recusados.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = Marcos (motorista, 3 avaliações: 5, 4 e 4) · N = Nina (motorista, sem avaliações)
-- P = Paulo, quem busca (MASCULINO) · Q, R e S = passageiros que avaliaram o Marcos
-- Ponto de busca: ULBRA Torres (-29.329, -49.7365). c2 fica mais perto que c1.
-- ------------------------------------------------------------

-- As caronas do seed.sql ficam perto de Torres e entrariam na busca; o rollback as devolve
delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'm@teste.edu.br',
   '{"nome_completo": "Marcos Motorista Silva", "genero": "MASCULINO", "telefone": "51988887777"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br',
   '{"nome_completo": "Nina Souza", "genero": "FEMININO"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br',
   '{"nome_completo": "Paulo Passageiro", "genero": "MASCULINO"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Quintino"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "Rita"}'),
  ('d0000000-0000-0000-0000-00000000000d', 's@teste.edu.br', '{"nome_completo": "Sara"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Onix', 'ABC1D23', 'Prata', 6),
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Gol', 'DEF4G56', 'Branco', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min,
  somente_mulheres
)
values
  -- c1: Marcos, 5 vagas (3 serão reservadas por quem o avaliou e ela continua ABERTA)
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
   'ULBRA Torres - RS', -29.329, -49.7365, now() + interval '1 day', 5, 5, 30, 10, false),
  -- c2: Nina, mais perto do ponto de busca
  ('70000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000e',
   'e1000000-0000-0000-0000-000000000001', 'Praia Grande, Torres - RS', -29.3300, -49.7300,
   'Centro, Torres - RS', -29.3353, -49.7268, now() + interval '2 days', 3, 3, 24, 5, false),
  -- c3: Nina, somente mulheres (RN18: Paulo não vê)
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e',
   'e1000000-0000-0000-0000-000000000001', 'Praia Grande, Torres - RS', -29.3300, -49.7300,
   'Centro, Torres - RS', -29.3353, -49.7268, now() + interval '3 days', 3, 3, 24, 5, true);

select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d');

-- As avaliações recebidas pelo Marcos (a regra de quando avaliar é da T30; aqui só a conta)
insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota)
select r.id_reserva, r.id_passageiro, 'a0000000-0000-0000-0000-00000000000a', n.nota
from public.reserva r
join (values
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 5),
    ('c0000000-0000-0000-0000-00000000000c'::uuid, 4),
    ('d0000000-0000-0000-0000-00000000000d'::uuid, 4))
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
-- Contrato: mesmos parâmetros e colunas da T18 na mesma ordem, e as duas novas no fim
-- ------------------------------------------------------------

set local search_path = public, extensions;
select is(
  pg_get_function_arguments('public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure),
  'p_lat numeric, p_lng numeric, p_raio_km numeric DEFAULT 10, p_somente_mulheres boolean DEFAULT false, '
    || 'p_data date DEFAULT NULL::date, p_pagina integer DEFAULT 1',
  'mesmos parâmetros e padrões da T18'
);
select is(
  pg_get_function_result('public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure),
  'TABLE(id_carona uuid, origem text, origem_lat numeric, origem_lng numeric, destino text, '
    || 'destino_lat numeric, destino_lng numeric, data_hora_partida timestamp with time zone, '
    || 'vagas_disponiveis integer, tolerancia_min integer, somente_mulheres boolean, '
    || 'distancia_km numeric, valor_por_passageiro numeric, nome_motorista text, modelo text, '
    || 'cor text, media_motorista numeric, total_avaliacoes_motorista integer)',
  'mesmas colunas e ordem da T18, mais media_motorista e total_avaliacoes_motorista no fim (sem id, e-mail, telefone ou gênero do motorista)'
);
select ok(
  (select prosecdef and provolatile = 's' and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure),
  'continua STABLE, SECURITY DEFINER e com search_path vazio'
);

-- ------------------------------------------------------------
-- Como P: as caronas dos outros, com a nota de cada motorista
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  $$select id_carona from public.buscar_caronas(-29.329, -49.7365)$$,
  $$values ('70000000-0000-0000-0000-000000000002'::uuid), ('70000000-0000-0000-0000-000000000001'::uuid)$$,
  'mesma ordem (a mais perto primeiro) e a carona somente mulheres fora para ele (RN18)'
);
select results_eq(
  $$select nome_motorista, media_motorista, total_avaliacoes_motorista
    from public.buscar_caronas(-29.329, -49.7365)
    where id_carona = '70000000-0000-0000-0000-000000000001'$$,
  $$values ('Marcos'::text, 4.3::numeric, 3)$$,
  'motorista com 3 avaliações (5, 4 e 4): média 4,3 (1 casa) e total 3'
);
select results_eq(
  $$select nome_motorista, media_motorista, total_avaliacoes_motorista
    from public.buscar_caronas(-29.329, -49.7365)
    where id_carona = '70000000-0000-0000-0000-000000000002'$$,
  $$values ('Nina'::text, null::numeric, 0)$$,
  'motorista sem avaliações: média nula e total 0'
);
select results_eq(
  $$select origem, destino, vagas_disponiveis, tolerancia_min, somente_mulheres,
      valor_por_passageiro, nome_motorista, modelo, cor
    from public.buscar_caronas(-29.329, -49.7365)$$,
  $$values
    ('Praia Grande, Torres - RS'::text, 'Centro, Torres - RS'::text, 3, 5, false, 6.00::numeric,
     'Nina'::text, 'Gol'::text, 'Branco'::text),
    ('Centro, Torres - RS'::text, 'ULBRA Torres - RS'::text, 2, 10, false, 5.00::numeric,
     'Marcos'::text, 'Onix'::text, 'Prata'::text)$$,
  'as colunas antigas continuam com os mesmos valores (rateio, primeiro nome, veículo, vagas)'
);
select ok(
  (select bool_and(distancia_km = round(distancia_km, 1) and distancia_km < 2)
   from public.buscar_caronas(-29.329, -49.7365)),
  'distância em km com 1 casa, como antes'
);
select is(
  (select count(*)::int from public.buscar_caronas(-29.329, -49.7365, p_pagina => 2)),
  0,
  'paginação igual: 20 por página, a página 2 vem vazia'
);
select throws_ok(
  $$select * from public.buscar_caronas(-29.329, -49.7365, p_raio_km => 51)$$,
  'PT400', 'DADOS_INVALIDOS', 'validação dos parâmetros igual (raio acima de 50 km)'
);

-- Como M: a própria carona não aparece (RN14); a da Nina sim, com a nota dela
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select id_carona, media_motorista, total_avaliacoes_motorista
    from public.buscar_caronas(-29.329, -49.7365)$$,
  $$values ('70000000-0000-0000-0000-000000000002'::uuid, null::numeric, 0)$$,
  'o motorista não vê a própria carona (RN14)'
);

-- Como N (FEMININO) com o filtro: só a somente mulheres... que é dela (RN14) → nenhuma
select public.teste_como('e0000000-0000-0000-0000-00000000000e');
select is(
  (select count(*)::int from public.buscar_caronas(-29.329, -49.7365, p_somente_mulheres => true)),
  0,
  'filtro somente mulheres igual (a única é da própria Nina)'
);

-- ------------------------------------------------------------
-- Acesso
-- ------------------------------------------------------------

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select * from public.buscar_caronas(-29.329, -49.7365)$$,
  'PT401', 'NAO_AUTENTICADO', 'sem auth.uid(): NAO_AUTENTICADO'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select * from public.buscar_caronas(-29.329, -49.7365)$$,
  '42501', null, 'anon não executa buscar_caronas'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)', 'execute')
    and not has_function_privilege('public', 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)', 'execute')
    and not has_function_privilege('anon', 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)', 'execute'),
  'authenticated executa; public e anon não'
);
select ok(
  not has_function_privilege('authenticated', 'public.resumo_avaliacoes(uuid)', 'execute'),
  'a resumo_avaliacoes continua interna (authenticated não executa direto)'
);

select * from finish();
rollback;
