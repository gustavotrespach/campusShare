-- T18 — buscar_caronas, detalhar_carona e valor_por_passageiro: RN08, proximidade e ordem,
-- visibilidade por gênero (RN18) e da própria carona (RN14), dia de Brasília, paginação, colunas
-- públicas, regras do detalhe, erros, acesso e ausência de recursão de RLS.
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · F = passageira FEMININO f0...0f · H = MASCULINO b0...0b (também
-- motorista de uma carona) · O = OUTRO c0...0c · N = NAO_INFORMADO e0...0e
-- Ponto de busca: Centro de Torres (-29.3353, -49.7268). 0,001° de latitude ≈ 0,11 km.
-- ------------------------------------------------------------

-- As caronas do seed.sql ficam perto de Torres e entrariam na busca; o rollback as devolve
delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br',
   '{"nome_completo": "Marcos Motorista Silva", "genero": "MASCULINO", "telefone": "51988887777"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'passageira@teste.edu.br',
   '{"nome_completo": "Fernanda Passageira", "genero": "FEMININO"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'passageiro@teste.edu.br',
   '{"nome_completo": "Henrique Passageiro", "genero": "MASCULINO"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'outro@teste.edu.br',
   '{"nome_completo": "Olívia Outro", "genero": "OUTRO"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'nao.informado@teste.edu.br',
   '{"nome_completo": "Nico Não Informado"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'ABC1D23', 'Prata', 5),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'Gol', 'BBB1B11', 'Branco', 5);

create function pg_temp.carona(
  p_id uuid,
  p_lat numeric,
  p_partida timestamptz,
  p_status public.status_carona default 'ABERTA',
  p_somente_mulheres boolean default false,
  p_custo numeric default 24,
  p_ofertadas int default 3,
  p_motorista uuid default 'a0000000-0000-0000-0000-00000000000a',
  p_veiculo uuid default 'a1000000-0000-0000-0000-000000000001',
  p_lng numeric default -49.7268
) returns void
language sql
as $$
  insert into public.carona (
    id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
    destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total,
    tolerancia_min, somente_mulheres, status
  ) values (
    p_id, p_motorista, p_veiculo, 'Origem ' || p_id, p_lat, p_lng, 'ULBRA Torres', -29.329,
    -49.7365, p_partida, p_ofertadas,
    case when p_status = 'LOTADA' then 0 else p_ofertadas end,
    p_custo, 10, p_somente_mulheres, p_status
  );
$$;

-- Perto (0,11 km): c1 amanhã e c2 depois de amanhã (mesma distância → ordem pelo horário)
select pg_temp.carona('10000000-0000-0000-0000-000000000001', -29.3363, now() + interval '1 day');
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000002', -29.3363, now() + interval '2 days', p_custo => 25,
  p_ofertadas => 2
);
-- Não aparecem: LOTADA, CANCELADA, CONCLUIDA e partida passada, todas a 0,11 km
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000004', -29.3363, now() + interval '1 day', 'LOTADA'
);
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000005', -29.3363, now() + interval '1 day', 'CANCELADA'
);
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000006', -29.3363, now() - interval '1 day', 'CONCLUIDA'
);
select pg_temp.carona('10000000-0000-0000-0000-000000000007', -29.3363, now() - interval '1 hour');
-- 0,22 km: carona do H (a própria não aparece para ele)
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000010', -29.3373, now() + interval '1 day',
  p_motorista => 'b0000000-0000-0000-0000-00000000000b',
  p_veiculo => 'b1000000-0000-0000-0000-000000000001'
);
-- 0,33 km: somente mulheres
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000009', -29.3383, now() + interval '3 days',
  p_somente_mulheres => true
);
-- 1,1 km: 23:30 de Brasília daqui a 6 dias (02:30 do dia seguinte em UTC)
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000011', -29.3453,
  ((now() at time zone 'America/Sao_Paulo')::date + 6 + time '23:30')
    at time zone 'America/Sao_Paulo'
);
-- 2,0 km
select pg_temp.carona('10000000-0000-0000-0000-000000000003', -29.3533, now() + interval '5 hours');
-- Porto Alegre: fora do raio de 10 km
select pg_temp.carona(
  '10000000-0000-0000-0000-000000000008', -30.0277, now() + interval '1 day', p_lng => -51.2287
);
-- 25 caronas em Arroio do Sal, para a paginação
insert into public.carona (
  id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
  data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
select 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
  'Arroio do Sal ' || n, -29.55 + n * 0.0001, -49.89, 'ULBRA Torres', -29.329, -49.7365,
  now() + interval '1 day', 3, 3, 24, 10
from generate_series(1, 25) as n;

-- H reservou a carona LOTADA (vê o detalhe dela)
insert into public.reserva (id_carona, id_passageiro, valor_individual)
values ('10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000b', 6.00);

-- Ids da busca padrão (Centro de Torres, raio 10), na ordem devolvida
create function public.teste_ids(p_somente_mulheres boolean default false, p_data date default null)
returns uuid[]
language sql
as $$
  select coalesce(array_agg(b.id_carona), '{}')
  from public.buscar_caronas(
    -29.3353, -49.7268, p_somente_mulheres => p_somente_mulheres, p_data => p_data
  ) b;
$$;
grant execute on function public.teste_ids to authenticated, anon;

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
-- Estrutura, colunas públicas e acesso
-- ------------------------------------------------------------

select has_function(
  'public', 'buscar_caronas',
  array['numeric', 'numeric', 'numeric', 'boolean', 'date', 'integer'],
  'buscar_caronas existe com a assinatura esperada'
);
select has_function('public', 'detalhar_carona', array['uuid'], 'detalhar_carona existe');
select has_function(
  'public', 'valor_por_passageiro', array['numeric', 'integer'], 'valor_por_passageiro existe'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.buscar_caronas'::regproc, 'public.detalhar_carona'::regproc)),
  'buscar_caronas e detalhar_carona são SECURITY DEFINER com search_path vazio'
);
select ok(
  not has_function_privilege(
    'anon', 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)', 'execute'
  ) and not has_function_privilege('anon', 'public.detalhar_carona(uuid)', 'execute'),
  'anon não tem EXECUTE nas RPCs'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)',
    'execute'
  ) and has_function_privilege('authenticated', 'public.detalhar_carona(uuid)', 'execute'),
  'authenticated tem EXECUTE nas RPCs'
);
select ok(
  not has_function_privilege('authenticated', 'public.valor_por_passageiro(numeric, int)', 'execute')
    and not has_function_privilege('anon', 'public.valor_por_passageiro(numeric, int)', 'execute'),
  'o app não executa valor_por_passageiro diretamente'
);
select ok(
  not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as nome
    where p.oid = 'public.buscar_caronas'::regproc
      and nome in ('telefone', 'email_institucional', 'id_motorista', 'placa', 'nome_completo')
  ),
  'busca não devolve telefone, e-mail, id_motorista, placa nem nome completo'
);
select ok(
  'placa' = any (select unnest(proargnames) from pg_proc
                 where oid = 'public.detalhar_carona'::regproc)
  and not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as nome
    where p.oid = 'public.detalhar_carona'::regproc
      and nome in ('telefone', 'email_institucional', 'id_motorista')
  ),
  'detalhe devolve a placa, mas não telefone, e-mail nem id_motorista'
);

-- Rateio (RN11)
select is(public.valor_por_passageiro(24, 3), 6.00, 'R$ 24,00 com 3 vagas → R$ 6,00 (4 ocupantes)');
select is(
  public.valor_por_passageiro(25, 2), 8.33,
  'R$ 25,00 com 2 vagas → R$ 8,33 (sobra de 1 centavo fica com o motorista)'
);

-- ------------------------------------------------------------
-- Busca como F (FEMININO)
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('f0000000-0000-0000-0000-00000000000f');

select is(
  public.teste_ids(),
  array[
    '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003'
  ]::uuid[],
  'só ABERTA, com vaga, futura e no raio (RN08), por distância e depois horário; '
    || 'somente_mulheres aparece para usuária'
);
select is(
  public.teste_ids(p_somente_mulheres => true),
  array['10000000-0000-0000-0000-000000000009']::uuid[],
  'filtro somente_mulheres = true devolve só essas caronas'
);
select results_eq(
  $$select distancia_km, valor_por_passageiro, nome_motorista, modelo, cor, vagas_disponiveis
    from public.buscar_caronas(-29.3353, -49.7268)
    where id_carona in ('10000000-0000-0000-0000-000000000001',
                        '10000000-0000-0000-0000-000000000002')
    order by data_hora_partida$$,
  $$values (0.1, 6.00, 'Marcos', 'Onix', 'Prata', 3), (0.1, 8.33, 'Marcos', 'Onix', 'Prata', 2)$$,
  'busca devolve distância com 1 casa, o valor por passageiro e só o primeiro nome'
);
select is(
  public.teste_ids(p_data => (now() at time zone 'America/Sao_Paulo')::date + 6),
  array['10000000-0000-0000-0000-000000000011']::uuid[],
  'p_data usa o dia de Brasília: partida às 23:30 entra no próprio dia'
);
select is(
  public.teste_ids(p_data => (now() at time zone 'America/Sao_Paulo')::date + 7),
  '{}'::uuid[],
  'e não entra no dia seguinte (que seria o dia em UTC)'
);
select is(
  (select count(*) from public.buscar_caronas(-29.55, -49.89, 5)),
  20::bigint,
  'primeira página tem 20 caronas'
);
select is(
  (select count(*) from public.buscar_caronas(-29.55, -49.89, 5, p_pagina => 2)),
  5::bigint,
  'segunda página tem as 5 restantes'
);
select is(
  (select count(distinct id_carona) from (
     select id_carona from public.buscar_caronas(-29.55, -49.89, 5)
     union all
     select id_carona from public.buscar_caronas(-29.55, -49.89, 5, p_pagina => 2)
   ) as paginas),
  25::bigint,
  'as duas páginas não se repetem'
);
select is(
  (select count(*) from public.buscar_caronas(-29.55, -49.89, 5, p_pagina => 3)),
  0::bigint,
  'página além do fim vem vazia'
);

-- ------------------------------------------------------------
-- Busca como H (MASCULINO, motorista da carona 10), O (OUTRO) e N (NAO_INFORMADO)
-- ------------------------------------------------------------

select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select is(
  public.teste_ids(),
  array[
    '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003'
  ]::uuid[],
  'MASCULINO não vê somente_mulheres, e ninguém vê a própria carona (RN14)'
);
select is(
  public.teste_ids(p_somente_mulheres => true), '{}'::uuid[],
  'MASCULINO com o filtro somente_mulheres não vê nada'
);

select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select ok(
  not ('10000000-0000-0000-0000-000000000009' = any (public.teste_ids())),
  'OUTRO não vê somente_mulheres'
);

select public.teste_como('e0000000-0000-0000-0000-00000000000e');
select ok(
  not ('10000000-0000-0000-0000-000000000009' = any (public.teste_ids())),
  'NAO_INFORMADO não vê somente_mulheres'
);

-- ------------------------------------------------------------
-- Detalhe
-- ------------------------------------------------------------

select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select results_eq(
  $$select status::text, vagas_ofertadas, vagas_disponiveis, custo_total, valor_por_passageiro,
      nome_motorista, modelo, cor, placa, sou_motorista
    from public.detalhar_carona('10000000-0000-0000-0000-000000000001')$$,
  $$values ('ABERTA', 3, 3, 24.00::numeric, 6.00::numeric, 'Marcos Motorista Silva', 'Onix',
      'Prata', 'ABC1D23', false)$$,
  'passageira vê o detalhe da carona aberta, com placa e nome completo'
);
select lives_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000009')$$,
  'passageira vê o detalhe da carona somente_mulheres'
);
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000007')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'carona aberta com partida passada não é visível a terceiros'
);

select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select status::text, sou_motorista
    from public.detalhar_carona('10000000-0000-0000-0000-000000000005')$$,
  $$values ('CANCELADA', true)$$,
  'motorista vê a própria carona cancelada'
);

select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select status::text, vagas_disponiveis
    from public.detalhar_carona('10000000-0000-0000-0000-000000000004')$$,
  $$values ('LOTADA', 0)$$,
  'passageiro com reserva vê a carona LOTADA'
);
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000009')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'MASCULINO sem reserva não vê o detalhe de somente_mulheres'
);

select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000005')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'terceiro não vê carona cancelada'
);
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000004')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'terceiro sem reserva não vê carona LOTADA'
);
select throws_ok(
  $$select * from public.detalhar_carona('99999999-0000-0000-0000-000000000000')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'carona inexistente tem a mesma resposta'
);

-- ------------------------------------------------------------
-- Erros de validação
-- ------------------------------------------------------------

select throws_ok(
  $$select * from public.buscar_caronas(91, -49.7268)$$,
  'PT400', 'DADOS_INVALIDOS', 'latitude fora da faixa é recusada'
);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -181)$$,
  'PT400', 'DADOS_INVALIDOS', 'longitude fora da faixa é recusada'
);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -49.7268, 0.5)$$,
  'PT400', 'DADOS_INVALIDOS', 'raio menor que 1 km é recusado'
);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -49.7268, 51)$$,
  'PT400', 'DADOS_INVALIDOS', 'raio maior que 50 km é recusado'
);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -49.7268, p_pagina => 0)$$,
  'PT400', 'DADOS_INVALIDOS', 'página 0 é recusada'
);
select throws_ok(
  $$select public.valor_por_passageiro(24, 3)$$,
  '42501', null, 'authenticated não chama valor_por_passageiro'
);

-- Sessão sem usuário
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -49.7268)$$,
  'PT401', 'NAO_AUTENTICADO', 'busca sem auth.uid() é recusada'
);
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000001')$$,
  'PT401', 'NAO_AUTENTICADO', 'detalhe sem auth.uid() é recusado'
);

-- ------------------------------------------------------------
-- RLS de reserva continua funcionando (sem recursão entre carona e reserva)
-- ------------------------------------------------------------

select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select id_passageiro from public.reserva$$,
  $$values ('b0000000-0000-0000-0000-00000000000b'::uuid)$$,
  'motorista lê a reserva da própria carona (política consulta carona, sem recursão)'
);
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select is(
  (select count(*) from public.reserva),
  1::bigint,
  'passageiro lê a própria reserva'
);
select is(
  (select count(*) from public.carona),
  1::bigint,
  'nenhuma política nova em carona: H continua lendo só a própria carona direto na tabela'
);

-- ------------------------------------------------------------
-- anon
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select * from public.buscar_caronas(-29.3353, -49.7268)$$,
  '42501', null, 'anon não executa buscar_caronas'
);
select throws_ok(
  $$select * from public.detalhar_carona('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon não executa detalhar_carona'
);

-- ------------------------------------------------------------
-- Políticas e valor da busca (como postgres)
-- ------------------------------------------------------------

reset role;
select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select is(
  (select b.valor_por_passageiro from public.buscar_caronas(-29.3353, -49.7268) b
   where b.id_carona = '10000000-0000-0000-0000-000000000002'),
  public.valor_por_passageiro(25, 2),
  'o valor da busca é exatamente o da função única (o mesmo que a reserva vai cobrar)'
);
select ok(
  (select count(*) = 0 from pg_policies
   where schemaname = 'public' and tablename in ('carona', 'usuario', 'veiculo')
     and policyname not in (
       'motorista lê as próprias caronas', 'usuário lê o próprio perfil',
       'usuário atualiza o próprio perfil', 'motorista lê os próprios veículos',
       'motorista cadastra os próprios veículos', 'motorista atualiza os próprios veículos',
       'motorista exclui os próprios veículos'
     )),
  'carona, usuario e veiculo só têm as políticas do schema_inicial'
);

select * from finish();
rollback;
