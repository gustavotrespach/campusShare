-- T06 — Estrutura do schema inicial: tabelas, PK, FK, UNIQUE, enums, índices, RLS e CHECKs.
begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

-- ------------------------------------------------------------
-- Tabelas e chaves
-- ------------------------------------------------------------

select has_table('public', 'instituicao', 'tabela instituicao existe');
select has_table('public', 'usuario', 'tabela usuario existe');
select has_table('public', 'veiculo', 'tabela veiculo existe');
select has_table('public', 'carona', 'tabela carona existe');

select col_is_pk('public', 'instituicao', 'id_instituicao', 'PK de instituicao');
select col_is_pk('public', 'usuario', 'id_usuario', 'PK de usuario');
select col_is_pk('public', 'veiculo', 'id_veiculo', 'PK de veiculo');
select col_is_pk('public', 'carona', 'id_carona', 'PK de carona');

select fk_ok('public', 'usuario', 'id_usuario', 'auth', 'users', 'id', 'usuario → auth.users');
select fk_ok(
  'public', 'usuario', 'id_instituicao', 'public', 'instituicao', 'id_instituicao',
  'usuario → instituicao'
);
select fk_ok(
  'public', 'veiculo', 'id_motorista', 'public', 'usuario', 'id_usuario', 'veiculo → usuario'
);
select fk_ok(
  'public', 'carona', 'id_motorista', 'public', 'usuario', 'id_usuario', 'carona → usuario'
);
select fk_ok(
  'public', 'carona', array['id_veiculo', 'id_motorista'],
  'public', 'veiculo', array['id_veiculo', 'id_motorista'],
  'carona → veiculo do mesmo motorista'
);

select col_is_unique('public', 'instituicao', 'dominio_email', 'dominio_email é único');
select col_is_unique('public', 'usuario', 'email_institucional', 'email_institucional é único');
select col_is_unique('public', 'veiculo', 'placa', 'placa é única');

-- ------------------------------------------------------------
-- Enums, defaults e índices
-- ------------------------------------------------------------

select enum_has_labels(
  'public', 'genero_usuario', array['FEMININO', 'MASCULINO', 'OUTRO', 'NAO_INFORMADO'],
  'enum genero_usuario'
);
select enum_has_labels(
  'public', 'status_carona', array['ABERTA', 'LOTADA', 'CANCELADA', 'CONCLUIDA'],
  'enum status_carona'
);
select col_type_is('public', 'usuario', 'genero', 'genero_usuario', 'usuario.genero usa o enum');
select col_type_is('public', 'carona', 'status', 'status_carona', 'carona.status usa o enum');
select col_default_is('public', 'carona', 'status', 'ABERTA', 'carona nasce ABERTA');
select col_default_is('public', 'carona', 'somente_mulheres', 'false', 'somente_mulheres = false');

select has_index(
  'public', 'carona', 'carona_status_data_hora_partida_idx', array['status', 'data_hora_partida'],
  'índice de busca por status e partida'
);
select has_index(
  'public', 'carona', 'carona_origem_lat_origem_lng_idx', array['origem_lat', 'origem_lng'],
  'índice de proximidade da origem'
);
select has_index(
  'public', 'veiculo', 'veiculo_id_motorista_idx', array['id_motorista'],
  'índice da coluna usada na RLS de veiculo'
);
select has_index(
  'public', 'carona', 'carona_id_motorista_idx', array['id_motorista'],
  'índice da coluna usada na RLS de carona'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.instituicao'::regclass, 'public.usuario'::regclass,
      'public.veiculo'::regclass, 'public.carona'::regclass
    )
  ),
  'RLS habilitada nas 4 tabelas'
);

-- ------------------------------------------------------------
-- CHECKs (executados como postgres, que ignora a RLS)
-- ------------------------------------------------------------

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br'),
  ('b0000000-0000-0000-0000-00000000000b', 'outro@teste.edu.br');

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into public.usuario (id_usuario, id_instituicao, nome_completo, email_institucional)
select u.id, i.id_instituicao, 'Usuário ' || u.email, u.email
from auth.users u
cross join public.instituicao i
where i.dominio_email = 'teste.edu.br'
  and u.email like '%@teste.edu.br';

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'ABC1D23', 'Prata', 5),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'Gol', 'XYZ1234', 'Branco', 5);

create function pg_temp.inserir_carona(
  p_id_veiculo uuid default 'a1000000-0000-0000-0000-000000000001',
  p_vagas smallint default 3,
  p_custo_total numeric default 40,
  p_custo_estimado numeric default null,
  p_tolerancia smallint default 10
) returns void
language sql
as $$
  insert into public.carona (
    id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
    data_hora_partida, vagas_disponiveis, custo_total, custo_estimado, tolerancia_min
  ) values (
    'a0000000-0000-0000-0000-00000000000a', p_id_veiculo,
    'Centro, Torres', -29.335, -49.727, 'ULBRA Torres', -29.330, -49.740,
    now() + interval '1 day', p_vagas, p_custo_total, p_custo_estimado, p_tolerancia
  );
$$;

-- Instituição e usuário
select throws_ok(
  $$insert into public.instituicao (nome, dominio_email) values ('X', '@x.edu.br')$$,
  '23514', null, 'domínio com @ é recusado'
);
select throws_ok(
  $$insert into public.instituicao (nome, dominio_email) values ('X', 'X.EDU.BR')$$,
  '23514', null, 'domínio em maiúsculas é recusado'
);
select throws_ok(
  $$update public.usuario set email_institucional = 'MOTORISTA@teste.edu.br'
    where id_usuario = 'a0000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'e-mail institucional em maiúsculas é recusado'
);

-- Placa
select lives_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'DEF4567', 'Azul', 5)$$,
  'placa no formato antigo é aceita'
);
select lives_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Kwid', 'GHI8J90', 'Preto', 5)$$,
  'placa no formato Mercosul é aceita'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'ABC-1234', 'Azul', 5)$$,
  '23514', null, 'placa com hífen é recusada'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'abc1d23', 'Azul', 5)$$,
  '23514', null, 'placa em minúsculas é recusada'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'AB12345', 'Azul', 5)$$,
  '23514', null, 'placa fora dos dois formatos é recusada'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'ABC1D23', 'Azul', 5)$$,
  '23505', null, 'placa duplicada é recusada'
);

-- Lugares e consumo
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Moto', 'MOT1A11', 'Azul', 1)$$,
  '23514', null, 'qtd_lugares = 1 é recusado'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Van', 'VAN1A11', 'Azul', 9)$$,
  '23514', null, 'qtd_lugares = 9 é recusado'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares, consumo_kml)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'UNO1A11', 'Azul', 5, 0)$$,
  '23514', null, 'consumo_kml = 0 é recusado'
);

-- Carona
select lives_ok($$select pg_temp.inserir_carona()$$, 'carona válida é aceita');
select throws_ok(
  $$select pg_temp.inserir_carona(p_tolerancia => -1::smallint)$$,
  '23514', null, 'tolerancia_min = -1 é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_tolerancia => 31::smallint)$$,
  '23514', null, 'tolerancia_min = 31 é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_custo_total => 0)$$,
  '23514', null, 'custo_total = 0 é recusado'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_custo_total => -10)$$,
  '23514', null, 'custo_total negativo é recusado'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_custo_total => 50.01, p_custo_estimado => 50)$$,
  '23514', null, 'custo_total acima do custo_estimado é recusado (teto, ADR-007)'
);
select lives_ok(
  $$select pg_temp.inserir_carona(p_custo_total => 50, p_custo_estimado => 50)$$,
  'custo_total igual ao custo_estimado é aceito'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_vagas => -1::smallint)$$,
  '23514', null, 'vagas_disponiveis negativa é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_vagas => 8::smallint)$$,
  '23514', null, 'vagas_disponiveis = 8 é recusada'
);
select throws_ok(
  $$select pg_temp.inserir_carona(p_id_veiculo => 'b1000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'carona com veículo de outro motorista é recusada'
);

select * from finish();
rollback;
