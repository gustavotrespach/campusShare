-- T44 (Parte A) — foto de perfil: bucket fotos-perfil (privado, 1 MB, só JPEG), políticas de
-- storage.objects (cada um escreve só em <uid>/avatar.jpg; logados leem; anon nada), RPCs
-- definir_foto_perfil e remover_foto_perfil, coluna foto_atualizada_em fora do UPDATE do app e o
-- caminho da foto (com ?v=) no fim da perfil_publico, da detalhar_carona e da buscar_caronas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- A = Ana (motorista, vai ter foto) · N = Nico (motorista, sem foto)
-- B = Bia (tem um arquivo enviado, para os testes de escrita cruzada) · C = Caio (busca, sem foto)
-- ------------------------------------------------------------

delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'a@teste.edu.br', '{"nome_completo": "Ana Lima"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br', '{"nome_completo": "Nico Souza"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@teste.edu.br', '{"nome_completo": "Bia Rocha"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@teste.edu.br', '{"nome_completo": "Caio Melo"}');

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
   'e1000000-0000-0000-0000-000000000001', 'Praia Grande, Torres - RS', -29.33, -49.73,
   'ULBRA Torres - RS', -29.329, -49.7365, now() + interval '2 days', 3, 3, 24, 10);

-- O arquivo da Bia, como se o Storage o tivesse gravado
insert into storage.objects (bucket_id, name, owner_id)
values ('fotos-perfil', 'b0000000-0000-0000-0000-00000000000b/avatar.jpg', 'b0000000-0000-0000-0000-00000000000b');

create function public.teste_como(p_id_usuario uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id_usuario, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function public.teste_como(uuid) to authenticated, anon;

-- Lê storage.objects ignorando a RLS (para conferir o que a escrita fez de fato)
create function public.teste_objetos(p_nome text) returns int
language sql
security definer
set search_path = ''
as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'fotos-perfil' and o.name = p_nome;
$$;
grant execute on function public.teste_objetos(text) to authenticated, anon;

-- ------------------------------------------------------------
-- Bucket e políticas
-- ------------------------------------------------------------

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'fotos-perfil'$$,
  $$values (false, 1048576::bigint, array['image/jpeg'])$$,
  'bucket fotos-perfil existe, privado, até 1 MB e só JPEG'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (qual like '%fotos-perfil%' or with_check like '%fotos-perfil%')),
  4,
  'quatro políticas do bucket: SELECT, INSERT, UPDATE e DELETE'
);
select ok(
  (select bool_and(roles = array['authenticated']::name[]) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (qual like '%fotos-perfil%' or with_check like '%fotos-perfil%')),
  'as políticas do bucket são só para authenticated (nada para anon nem public)'
);
select ok(
  (select bool_and(
     coalesce(qual, with_check) is not null
     and (qual is null or qual like '%avatar.jpg%')
     and (with_check is null or with_check like '%avatar.jpg%'))
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and cmd in ('INSERT', 'UPDATE', 'DELETE')
     and (qual like '%fotos-perfil%' or with_check like '%fotos-perfil%')),
  'nenhuma política de escrita é using (true): todas exigem o caminho <uid>/avatar.jpg'
);

-- ------------------------------------------------------------
-- Escrita no Storage como Ana
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos-perfil', 'a0000000-0000-0000-0000-00000000000a/avatar.jpg', 'a0000000-0000-0000-0000-00000000000a')$$,
  'Ana envia a própria foto em <id da Ana>/avatar.jpg'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('fotos-perfil', 'c0000000-0000-0000-0000-00000000000c/avatar.jpg')$$,
  '42501', null, 'Ana não envia no caminho de outro usuário'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('fotos-perfil', 'a0000000-0000-0000-0000-00000000000a/outra.jpg')$$,
  '42501', null, 'Ana não envia com outro nome de arquivo'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('fotos-perfil', 'a0000000-0000-0000-0000-00000000000a/sub/avatar.jpg')$$,
  '42501', null, 'Ana não envia em subpasta'
);
with trocadas as (
  update storage.objects set metadata = '{"trocada": true}'
  where bucket_id = 'fotos-perfil' and name = 'a0000000-0000-0000-0000-00000000000a/avatar.jpg'
  returning 1
)
select is(count(*)::int, 1, 'Ana troca a própria foto (upsert = INSERT + UPDATE)') from trocadas;

-- O UPDATE e o DELETE da RLS não acham a linha da Bia: nada muda
update storage.objects set metadata = '{"invadida": true}'
where name = 'b0000000-0000-0000-0000-00000000000b/avatar.jpg';
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = 'b0000000-0000-0000-0000-00000000000b/avatar.jpg';
select set_config('storage.allow_delete_query', 'false', true);
reset role;

select is(
  (select metadata from storage.objects where name = 'b0000000-0000-0000-0000-00000000000b/avatar.jpg'),
  null::jsonb,
  'Ana não altera a foto da Bia'
);
select is(
  public.teste_objetos('b0000000-0000-0000-0000-00000000000b/avatar.jpg'),
  1,
  'Ana não apaga a foto da Bia'
);

-- Leitura: logados leem as fotos dos outros
set local role authenticated;
select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'fotos-perfil'),
  2,
  'um usuário logado lê as fotos de todos (Ana e Bia)'
);
reset role;

-- ------------------------------------------------------------
-- anon: não lê nem escreve
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'fotos-perfil'),
  0,
  'anon não lê nenhuma foto'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('fotos-perfil', 'qualquer/avatar.jpg')$$,
  '42501', null, 'anon não envia foto'
);
select throws_ok(
  $$select public.definir_foto_perfil()$$,
  '42501', null, 'anon não executa definir_foto_perfil'
);
select throws_ok(
  $$select public.remover_foto_perfil()$$,
  '42501', null, 'anon não executa remover_foto_perfil'
);
reset role;

-- ------------------------------------------------------------
-- RPCs e a coluna foto_atualizada_em
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.definir_foto_perfil()$$,
  'PT409', 'FOTO_NAO_ENVIADA', 'definir sem o arquivo no Storage: FOTO_NAO_ENVIADA'
);

select public.teste_como('a0000000-0000-0000-0000-00000000000a');
create temp table definida as select public.definir_foto_perfil() as em;
select is(
  (select foto_atualizada_em from public.usuario where id_usuario = auth.uid()),
  (select em from definida),
  'definir com o arquivo grava foto_atualizada_em e devolve a mesma data'
);
select throws_ok(
  $$update public.usuario set foto_atualizada_em = null where id_usuario = auth.uid()$$,
  '42501', null, 'o app não altera foto_atualizada_em direto (fora do grant de UPDATE)'
);
select lives_ok(
  $$update public.usuario set nome_completo = 'Ana Lima' where id_usuario = auth.uid()$$,
  'as colunas editáveis do perfil continuam liberadas'
);
reset role;

-- Data fixa para o ?v= dar um número conhecido: 24/11/2026 12:00 UTC = 1795521600
update public.usuario set foto_atualizada_em = '2026-11-24 12:00:00+00'
where id_usuario = 'a0000000-0000-0000-0000-00000000000a';

set local role authenticated;
select public.teste_como('c0000000-0000-0000-0000-00000000000c');

select is(
  (select foto_caminho from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')),
  'a0000000-0000-0000-0000-00000000000a/avatar.jpg?v=1795521600',
  'perfil_publico: foto_caminho com ?v= da data da foto'
);
select is(
  (select foto_caminho from public.perfil_publico('e0000000-0000-0000-0000-00000000000e')),
  null,
  'perfil_publico: foto_caminho nulo sem foto'
);
select is(
  (select foto_motorista from public.detalhar_carona('70000000-0000-0000-0000-000000000001')),
  'a0000000-0000-0000-0000-00000000000a/avatar.jpg?v=1795521600',
  'detalhar_carona: foto_motorista com ?v='
);
select is(
  (select foto_motorista from public.detalhar_carona('70000000-0000-0000-0000-000000000002')),
  null,
  'detalhar_carona: foto_motorista nulo sem foto'
);
select results_eq(
  $$select id_carona, foto_motorista from public.buscar_caronas(-29.3353, -49.7268) order by id_carona$$,
  $$values
    ('70000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-00000000000a/avatar.jpg?v=1795521600'::text),
    ('70000000-0000-0000-0000-000000000002'::uuid, null::text)$$,
  'buscar_caronas: foto_motorista com ?v= e nulo sem foto'
);
select results_eq(
  $$select nome, media_avaliacoes, total_avaliacoes from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')$$,
  $$values ('Ana Lima'::text, null::numeric, 0)$$,
  'perfil_publico: colunas antigas com os mesmos valores'
);

-- Remover: a Ana apaga o arquivo pela API (DELETE com a política) e zera a coluna
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = 'a0000000-0000-0000-0000-00000000000a/avatar.jpg';
select set_config('storage.allow_delete_query', 'false', true);
select is(
  public.teste_objetos('a0000000-0000-0000-0000-00000000000a/avatar.jpg'),
  0,
  'Ana apaga a própria foto (política de DELETE)'
);
select lives_ok($$select public.remover_foto_perfil()$$, 'remover_foto_perfil roda');
select is(
  (select foto_caminho from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')),
  null,
  'depois de remover, foto_caminho volta a ser nulo'
);

-- Sem auth.uid()
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.definir_foto_perfil()$$,
  'PT401', 'NAO_AUTENTICADO', 'definir sem auth.uid(): NAO_AUTENTICADO'
);
select throws_ok(
  $$select public.remover_foto_perfil()$$,
  'PT401', 'NAO_AUTENTICADO', 'remover sem auth.uid(): NAO_AUTENTICADO'
);
reset role;

-- ------------------------------------------------------------
-- Contratos: colunas antigas na mesma ordem, a foto no fim
-- ------------------------------------------------------------

set local search_path = public, extensions;
select is(
  pg_get_function_result('public.perfil_publico(uuid)'::regprocedure),
  'TABLE(id_usuario uuid, nome text, media_avaliacoes numeric, total_avaliacoes integer, foto_caminho text)',
  'perfil_publico: contrato da T30 + foto_caminho no fim'
);
select is(
  pg_get_function_result('public.detalhar_carona(uuid)'::regprocedure),
  'TABLE(id_carona uuid, origem text, origem_lat numeric, origem_lng numeric, destino text, '
    || 'destino_lat numeric, destino_lng numeric, data_hora_partida timestamp with time zone, '
    || 'vagas_disponiveis integer, vagas_ofertadas integer, tolerancia_min integer, '
    || 'somente_mulheres boolean, status status_carona, custo_total numeric, '
    || 'valor_por_passageiro numeric, nome_motorista text, modelo text, cor text, placa text, '
    || 'sou_motorista boolean, media_motorista numeric, total_avaliacoes_motorista integer, '
    || 'foto_motorista text)',
  'detalhar_carona: contrato da T30 + foto_motorista no fim'
);
select is(
  pg_get_function_result('public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure),
  'TABLE(id_carona uuid, origem text, origem_lat numeric, origem_lng numeric, destino text, '
    || 'destino_lat numeric, destino_lng numeric, data_hora_partida timestamp with time zone, '
    || 'vagas_disponiveis integer, tolerancia_min integer, somente_mulheres boolean, '
    || 'distancia_km numeric, valor_por_passageiro numeric, nome_motorista text, modelo text, '
    || 'cor text, media_motorista numeric, total_avaliacoes_motorista integer, foto_motorista text)',
  'buscar_caronas: contrato da T43 + foto_motorista no fim'
);
select is(
  pg_get_function_arguments('public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure),
  'p_lat numeric, p_lng numeric, p_raio_km numeric DEFAULT 10, p_somente_mulheres boolean DEFAULT false, '
    || 'p_data date DEFAULT NULL::date, p_pagina integer DEFAULT 1',
  'buscar_caronas: mesmos parâmetros'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in (
     'public.definir_foto_perfil()'::regprocedure, 'public.remover_foto_perfil()'::regprocedure,
     'public.perfil_publico(uuid)'::regprocedure, 'public.detalhar_carona(uuid)'::regprocedure,
     'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)'::regprocedure)),
  'as cinco funções são SECURITY DEFINER com search_path vazio'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'execute')
     and not has_function_privilege('anon', f, 'execute')
     and not has_function_privilege('public', f, 'execute'))
   from unnest(array[
     'public.definir_foto_perfil()', 'public.remover_foto_perfil()', 'public.perfil_publico(uuid)',
     'public.detalhar_carona(uuid)',
     'public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)']) f),
  'grants refeitos: authenticated executa; anon e public não'
);
select ok(
  not has_function_privilege('authenticated', 'public.caminho_foto_perfil(uuid, timestamptz)', 'execute')
    and not has_column_privilege('authenticated', 'public.usuario', 'foto_atualizada_em', 'update')
    and has_column_privilege('authenticated', 'public.usuario', 'foto_atualizada_em', 'select'),
  'caminho_foto_perfil é interna; foto_atualizada_em: SELECT sim, UPDATE não'
);

select * from finish();
rollback;
