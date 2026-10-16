-- T15 — Regras de veículos: exclusão recusada com carona ativa ou histórico, RLS de escrita
-- (outro motorista e anon) e exclusão da conta em cascata. Placa e qtd_lugares: 01_estrutura.
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- A = a0000000-...-00a · B = b0000000-...-00b
-- Veículos de A: a1...01 sem caronas · a1...02 ABERTA · a1...03 LOTADA · a1...04 histórico
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'usuario.a@teste.edu.br',
   '{"nome_completo": "Usuário A"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'usuario.b@teste.edu.br',
   '{"nome_completo": "Usuário B"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'AAA1A11', 'Prata', 5),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
   'Kwid', 'AAA2A22', 'Preto', 5),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a',
   'Uno', 'AAA3A33', 'Azul', 5),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a',
   'Palio', 'AAA4A44', 'Vermelho', 5),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'Gol', 'BBB1B11', 'Branco', 5);

create function pg_temp.inserir_carona(p_id_veiculo uuid, p_status public.status_carona)
returns void
language sql
as $$
  insert into public.carona (
    id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
    data_hora_partida, vagas_disponiveis, custo_total, tolerancia_min, status
  ) values (
    'a0000000-0000-0000-0000-00000000000a', p_id_veiculo,
    'Centro, Torres', -29.335, -49.727, 'ULBRA Torres', -29.330, -49.740,
    now() + interval '1 day', case when p_status = 'LOTADA' then 0 else 3 end, 40, 10, p_status
  );
$$;

select pg_temp.inserir_carona('a1000000-0000-0000-0000-000000000002', 'ABERTA');
select pg_temp.inserir_carona('a1000000-0000-0000-0000-000000000002', 'CONCLUIDA');
select pg_temp.inserir_carona('a1000000-0000-0000-0000-000000000003', 'LOTADA');
select pg_temp.inserir_carona('a1000000-0000-0000-0000-000000000004', 'CONCLUIDA');
select pg_temp.inserir_carona('a1000000-0000-0000-0000-000000000004', 'CANCELADA');

-- Devolve "message | hint" do erro da exclusão, para conferir a frase que o app mostra
create function pg_temp.erro_ao_excluir(p_id_veiculo uuid)
returns text
language plpgsql
as $$
declare
  v_mensagem text;
  v_hint text;
begin
  delete from public.veiculo where id_veiculo = p_id_veiculo;
  return 'sem erro';
exception when others then
  get stacked diagnostics v_mensagem = message_text, v_hint = pg_exception_hint;
  return v_mensagem || ' | ' || v_hint;
end;
$$;

-- ------------------------------------------------------------
-- Estrutura do trigger
-- ------------------------------------------------------------

select has_trigger(
  'public', 'veiculo', 'impedir_exclusao_veiculo_em_uso', 'trigger de exclusão existe em veiculo'
);
select trigger_is(
  'public', 'veiculo', 'impedir_exclusao_veiculo_em_uso',
  'public', 'impedir_exclusao_veiculo_em_uso', 'trigger chama a função da regra'
);
select is_definer(
  'public', 'impedir_exclusao_veiculo_em_uso', 'função do trigger é SECURITY DEFINER'
);
select ok(
  not has_function_privilege('anon', 'public.impedir_exclusao_veiculo_em_uso()', 'execute'),
  'anon não executa a função do trigger'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.impedir_exclusao_veiculo_em_uso()', 'execute'
  ),
  'authenticated não executa a função do trigger'
);

-- ------------------------------------------------------------
-- Como o usuário A (authenticated)
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

-- Exclusão do próprio veículo
select results_eq(
  $$delete from public.veiculo where id_veiculo = 'a1000000-0000-0000-0000-000000000001'
    returning placa::text$$,
  $$values ('AAA1A11'::text)$$,
  'A exclui o próprio veículo sem caronas'
);
select throws_ok(
  $$delete from public.veiculo where id_veiculo = 'a1000000-0000-0000-0000-000000000002'$$,
  'PT409', 'VEICULO_EM_USO', 'veículo com carona ABERTA não é excluído (mesmo com histórico)'
);
select throws_ok(
  $$delete from public.veiculo where id_veiculo = 'a1000000-0000-0000-0000-000000000003'$$,
  'PT409', 'VEICULO_EM_USO', 'veículo com carona LOTADA não é excluído'
);
select throws_ok(
  $$delete from public.veiculo where id_veiculo = 'a1000000-0000-0000-0000-000000000004'$$,
  'PT409', 'VEICULO_COM_HISTORICO', 'veículo só com caronas CONCLUIDA/CANCELADA não é excluído'
);

-- Alteração do próprio veículo
select results_eq(
  $$update public.veiculo set cor = 'Grafite', consumo_kml = 12.5
    where id_veiculo = 'a1000000-0000-0000-0000-000000000002' returning cor::text$$,
  $$values ('Grafite'::text)$$,
  'A altera o próprio veículo'
);
select throws_ok(
  $$update public.veiculo set id_motorista = 'b0000000-0000-0000-0000-00000000000b'
    where id_veiculo = 'a1000000-0000-0000-0000-000000000004'$$,
  '42501', null, 'A não transfere o próprio veículo para B'
);

-- Veículo de outro motorista: a RLS filtra a linha, nenhuma é afetada
select is_empty(
  $$update public.veiculo set modelo = 'Invadido'
    where id_veiculo = 'b1000000-0000-0000-0000-000000000001' returning 1$$,
  'UPDATE no veículo de B não afeta nenhuma linha'
);
select is_empty(
  $$delete from public.veiculo where id_veiculo = 'b1000000-0000-0000-0000-000000000001'
    returning 1$$,
  'DELETE no veículo de B não afeta nenhuma linha'
);

-- ------------------------------------------------------------
-- Efeitos e mensagens (como postgres)
-- ------------------------------------------------------------

reset role;

select is(
  pg_temp.erro_ao_excluir('a1000000-0000-0000-0000-000000000003'),
  'VEICULO_EM_USO | Este veículo está em uma carona ativa. '
    || 'Cancele ou conclua a carona antes de excluí-lo.',
  'VEICULO_EM_USO traz a frase em pt-BR no hint'
);
select is(
  pg_temp.erro_ao_excluir('a1000000-0000-0000-0000-000000000004'),
  'VEICULO_COM_HISTORICO | Este veículo tem caronas registradas no histórico '
    || 'e não pode ser excluído.',
  'VEICULO_COM_HISTORICO traz a frase em pt-BR no hint'
);
select results_eq(
  $$select placa::text from public.veiculo
    where id_motorista = 'a0000000-0000-0000-0000-00000000000a' order by placa$$,
  $$values ('AAA2A22'::text), ('AAA3A33'::text), ('AAA4A44'::text)$$,
  'veículos em uso e com histórico continuam cadastrados'
);
select is(
  (select modelo::text from public.veiculo
   where id_veiculo = 'b1000000-0000-0000-0000-000000000001'),
  'Gol',
  'veículo de B continua intacto'
);

-- ------------------------------------------------------------
-- Como anon: nenhuma escrita (leitura recusada em 02_rls)
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('a0000000-0000-0000-0000-00000000000a', 'Uno', 'ANO1A11', 'Azul', 5)$$,
  '42501', null, 'anon não cadastra veículo'
);
select throws_ok(
  $$update public.veiculo set cor = 'anon'
    where id_veiculo = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anon não altera veículo'
);
select throws_ok(
  $$delete from public.veiculo where id_veiculo = 'b1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anon não exclui veículo'
);

-- ------------------------------------------------------------
-- Exclusão da conta (como postgres): a cascata leva veículos e caronas, mesmo em uso
-- ------------------------------------------------------------

reset role;

select lives_ok(
  $$delete from auth.users where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'conta com veículos em uso e com histórico pode ser excluída'
);
select is(
  (select count(*) from public.veiculo
   where id_motorista = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'a cascata removeu os veículos da conta excluída'
);
select is(
  (select count(*) from public.carona
   where id_motorista = 'a0000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'a cascata removeu as caronas da conta excluída'
);

select * from finish();
rollback;
