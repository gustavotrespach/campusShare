-- T06 — RLS e grants: cada usuário só acessa os próprios dados; carona não aceita escrita direta.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- A = a0000000-...-00a · B = b0000000-...-00b
-- ------------------------------------------------------------

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000000a', 'usuario.a@teste.edu.br'),
  ('b0000000-0000-0000-0000-00000000000b', 'usuario.b@teste.edu.br');

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');
insert into public.instituicao (nome, dominio_email) values ('Outra Instituição', 'outra.edu.br');

insert into public.usuario (id_usuario, id_instituicao, nome_completo, email_institucional)
select u.id, i.id_instituicao, n.nome, u.email
from auth.users u
join (
  values
    ('a0000000-0000-0000-0000-00000000000a'::uuid, 'Usuário A'),
    ('b0000000-0000-0000-0000-00000000000b'::uuid, 'Usuário B')
) as n (id, nome) on n.id = u.id
cross join public.instituicao i
where i.dominio_email = 'teste.edu.br';

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'AAA1A11', 'Prata', 5),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'Gol', 'BBB1B11', 'Branco', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_disponiveis, custo_total, tolerancia_min
)
values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro', -29.335, -49.727, 'ULBRA', -29.330,
   -49.740, now() + interval '1 day', 3, 40, 10),
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'b1000000-0000-0000-0000-000000000001', 'Centro', -29.335, -49.727, 'ULBRA', -29.330,
   -49.740, now() + interval '1 day', 3, 40, 10);

-- ------------------------------------------------------------
-- Como o usuário A (authenticated)
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

-- Leitura
select results_eq(
  $$select id_usuario from public.usuario$$,
  $$values ('a0000000-0000-0000-0000-00000000000a'::uuid)$$,
  'A lê só o próprio perfil'
);
select is_empty(
  $$select 1 from public.usuario where id_usuario = 'b0000000-0000-0000-0000-00000000000b'$$,
  'A não lê o perfil de B'
);
select results_eq(
  $$select placa::text from public.veiculo$$,
  $$values ('AAA1A11'::text)$$,
  'A lê só os próprios veículos'
);
select is_empty(
  $$select 1 from public.veiculo where id_motorista = 'b0000000-0000-0000-0000-00000000000b'$$,
  'A não lê os veículos de B'
);
select results_eq(
  $$select id_carona from public.carona$$,
  $$values ('a2000000-0000-0000-0000-000000000001'::uuid)$$,
  'A lê só as próprias caronas'
);
select results_eq(
  $$select dominio_email::text from public.instituicao
    where dominio_email in ('teste.edu.br', 'outra.edu.br') order by 1$$,
  $$values ('outra.edu.br'::text), ('teste.edu.br'::text)$$,
  'autenticado lê as instituições'
);

-- Perfil: só colunas liberadas, só a própria linha
select lives_ok(
  $$update public.usuario set nome_completo = 'Usuário A editado', telefone = '51999990000',
      genero = 'FEMININO', expo_push_token = 'ExponentPushToken[teste]'
    where id_usuario = 'a0000000-0000-0000-0000-00000000000a'$$,
  'A altera as colunas liberadas do próprio perfil'
);
select throws_ok(
  $$update public.usuario set email_institucional = 'outro@teste.edu.br'
    where id_usuario = 'a0000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A não altera o próprio email_institucional'
);
select throws_ok(
  $$update public.usuario set id_instituicao = (
      select id_instituicao from public.instituicao where dominio_email = 'outra.edu.br')
    where id_usuario = 'a0000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A não altera a própria instituição'
);
select lives_ok(
  $$update public.usuario set nome_completo = 'Invadido'
    where id_usuario = 'b0000000-0000-0000-0000-00000000000b'$$,
  'UPDATE no perfil de B não falha, mas a RLS filtra a linha (verificado abaixo)'
);
select throws_ok(
  $$insert into public.usuario (id_usuario, id_instituicao, nome_completo, email_institucional)
    values ('a0000000-0000-0000-0000-00000000000a', 1, 'X', 'x@teste.edu.br')$$,
  '42501', null, 'A não insere perfil direto (criado pelo trigger do Auth)'
);

-- Veículos
select lives_ok(
  $$insert into public.veiculo (modelo, placa, cor, qtd_lugares)
    values ('Kwid', 'AAA2A22', 'Preto', 5)$$,
  'A cadastra veículo (id_motorista = auth.uid() por default)'
);
select throws_ok(
  $$insert into public.veiculo (id_motorista, modelo, placa, cor, qtd_lugares)
    values ('b0000000-0000-0000-0000-00000000000b', 'Uno', 'AAA3A33', 'Azul', 5)$$,
  '42501', null, 'A não cadastra veículo em nome de B'
);
select lives_ok(
  $$delete from public.veiculo where id_motorista = 'b0000000-0000-0000-0000-00000000000b'$$,
  'DELETE nos veículos de B não falha, mas a RLS filtra as linhas (verificado abaixo)'
);

-- Carona: escrita só por funções SQL
select throws_ok(
  $$insert into public.carona (
      id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
      destino_lng, data_hora_partida, vagas_disponiveis, custo_total, tolerancia_min)
    values ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
      'Centro', -29.335, -49.727, 'ULBRA', -29.330, -49.740, now() + interval '1 day', 3, 40, 10)$$,
  '42501', null, 'A não insere carona direto'
);
select throws_ok(
  $$update public.carona set custo_total = 1
    where id_carona = 'a2000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A não altera a própria carona direto'
);
select throws_ok(
  $$delete from public.carona where id_carona = 'a2000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A não exclui a própria carona direto'
);

-- Instituição: só leitura
select throws_ok(
  $$insert into public.instituicao (nome, dominio_email) values ('Falsa', 'falsa.edu.br')$$,
  '42501', null, 'A não cadastra instituição'
);

-- ------------------------------------------------------------
-- Efeitos (como postgres)
-- ------------------------------------------------------------

reset role;

select is(
  (select nome_completo::text from public.usuario
   where id_usuario = 'b0000000-0000-0000-0000-00000000000b'),
  'Usuário B',
  'perfil de B continua intacto'
);
select is(
  (select count(*) from public.veiculo
   where id_motorista = 'b0000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'veículo de B continua cadastrado'
);
select is(
  (select nome_completo::text from public.usuario
   where id_usuario = 'a0000000-0000-0000-0000-00000000000a'),
  'Usuário A editado',
  'perfil de A foi atualizado'
);

-- ------------------------------------------------------------
-- Como anon: nenhum acesso
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok($$select 1 from public.instituicao$$, '42501', null, 'anon não lê instituicao');
select throws_ok($$select 1 from public.usuario$$, '42501', null, 'anon não lê usuario');
select throws_ok($$select 1 from public.veiculo$$, '42501', null, 'anon não lê veiculo');
select throws_ok($$select 1 from public.carona$$, '42501', null, 'anon não lê carona');

select * from finish();
rollback;
