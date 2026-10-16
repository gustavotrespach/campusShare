-- T09 — Hook validar_dominio_institucional (RN01) e trigger criar_perfil_usuario.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ------------------------------------------------------------
-- Hook: domínio exato, em minúsculas
-- ------------------------------------------------------------

create function pg_temp.hook(p_email text) returns jsonb
language sql
as $$
  select public.validar_dominio_institucional(
    jsonb_build_object('user', jsonb_build_object('email', p_email))
  );
$$;

select is(pg_temp.hook('aluno@rede.ulbra.br'), '{}'::jsonb, 'domínio da ULBRA é aceito');
select is(
  pg_temp.hook('Aluno.Teste@REDE.ULBRA.BR'), '{}'::jsonb, 'domínio em maiúsculas é aceito'
);
select is(
  pg_temp.hook('  aluno@rede.ulbra.br  '), '{}'::jsonb, 'espaços nas pontas são ignorados'
);
select is(
  pg_temp.hook('aluno@gmail.com'),
  '{"error": {"http_code": 422, "message": "DOMINIO_INVALIDO"}}'::jsonb,
  'outro domínio é recusado com 422 DOMINIO_INVALIDO'
);
select is(
  pg_temp.hook('aluno@rede.ulbra.br.fake.com') -> 'error' ->> 'message', 'DOMINIO_INVALIDO',
  'subdomínio falso (rede.ulbra.br.fake.com) é recusado'
);
select is(
  pg_temp.hook('aluno@fake.rede.ulbra.br') -> 'error' ->> 'message', 'DOMINIO_INVALIDO',
  'subdomínio do domínio institucional é recusado (comparação exata)'
);
select is(
  pg_temp.hook('aluno@ulbra.br') -> 'error' ->> 'message', 'DOMINIO_INVALIDO',
  'domínio pai é recusado'
);
select is(
  pg_temp.hook('rede.ulbra.br') -> 'error' ->> 'message', 'DOMINIO_INVALIDO',
  'e-mail sem @ é recusado'
);
select is(
  public.validar_dominio_institucional('{"user": {"phone": "5551999990000"}}'::jsonb)
    -> 'error' ->> 'message',
  'DOMINIO_INVALIDO',
  'cadastro sem e-mail é recusado'
);

-- ------------------------------------------------------------
-- Hook: privilégios e segurança
-- ------------------------------------------------------------

select ok(
  has_function_privilege('supabase_auth_admin', 'public.validar_dominio_institucional(jsonb)', 'execute'),
  'supabase_auth_admin executa o hook'
);
select ok(
  not has_function_privilege('anon', 'public.validar_dominio_institucional(jsonb)', 'execute'),
  'anon não executa o hook'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.validar_dominio_institucional(jsonb)', 'execute'
  ),
  'authenticated não executa o hook'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.validar_dominio_institucional(jsonb)'::regprocedure),
  'hook é SECURITY DEFINER com search_path vazio'
);

set local role anon;
select throws_ok(
  $$select public.validar_dominio_institucional('{"user": {"email": "a@rede.ulbra.br"}}')$$,
  '42501', null, 'anon recebe permissão negada ao chamar o hook'
);
reset role;

-- ------------------------------------------------------------
-- Trigger: perfil criado a partir de raw_user_meta_data
-- ------------------------------------------------------------

select has_trigger('auth', 'users', 'criar_perfil_usuario', 'trigger existe em auth.users');
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.criar_perfil_usuario()'::regprocedure),
  'função do trigger é SECURITY DEFINER com search_path vazio'
);
select ok(
  not has_function_privilege('authenticated', 'public.criar_perfil_usuario()', 'execute')
    and not has_function_privilege('anon', 'public.criar_perfil_usuario()', 'execute'),
  'app não executa a função do trigger'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('e0000000-0000-0000-0000-000000000001', 'Mariana.Souza@REDE.ULBRA.BR',
   '{"nome_completo": "  Mariana Souza ", "genero": "feminino", "telefone": "51999999999"}'),
  ('e0000000-0000-0000-0000-000000000002', 'sem.genero@rede.ulbra.br',
   '{"nome_completo": "Sem Gênero"}'),
  ('e0000000-0000-0000-0000-000000000003', 'genero.invalido@rede.ulbra.br',
   '{"nome_completo": "Gênero Inválido", "genero": "XYZ", "telefone": "  "}'),
  ('e0000000-0000-0000-0000-000000000004', 'sem.nome@rede.ulbra.br', null);

select results_eq(
  $$select u.nome_completo::text, u.email_institucional::text, u.genero::text, u.telefone::text,
      i.dominio_email::text
    from public.usuario u
    join public.instituicao i using (id_instituicao)
    where u.id_usuario = 'e0000000-0000-0000-0000-000000000001'$$,
  $$values ('Mariana Souza', 'mariana.souza@rede.ulbra.br', 'FEMININO', '51999999999',
      'rede.ulbra.br')$$,
  'perfil criado com nome, e-mail minúsculo, gênero, telefone e instituição do domínio'
);
select results_eq(
  $$select genero::text, telefone from public.usuario
    where id_usuario = 'e0000000-0000-0000-0000-000000000002'$$,
  $$values ('NAO_INFORMADO', null::varchar)$$,
  'gênero ausente vira NAO_INFORMADO e telefone ausente fica nulo'
);
select results_eq(
  $$select genero::text, telefone from public.usuario
    where id_usuario = 'e0000000-0000-0000-0000-000000000003'$$,
  $$values ('NAO_INFORMADO', null::varchar)$$,
  'gênero fora do enum vira NAO_INFORMADO e telefone em branco fica nulo'
);
select is(
  (select nome_completo::text from public.usuario
   where id_usuario = 'e0000000-0000-0000-0000-000000000004'),
  'sem.nome',
  'sem nome nos metadados, usa a parte antes do @'
);
select is(
  (select count(*) from public.usuario
   where id_usuario::text like 'e0000000-%'),
  4::bigint,
  'um perfil por usuário criado'
);

-- Defesa em profundidade: usuário criado por fora do hook com outro domínio
select throws_ok(
  $$insert into auth.users (id, email)
    values ('e0000000-0000-0000-0000-000000000009', 'intruso@gmail.com')$$,
  'PT422', 'DOMINIO_INVALIDO', 'trigger recusa usuário de domínio sem instituição'
);
select throws_ok(
  $$insert into auth.users (id, email)
    values ('e0000000-0000-0000-0000-000000000008', 'aluno@rede.ulbra.br.fake.com')$$,
  'PT422', 'DOMINIO_INVALIDO', 'trigger recusa subdomínio falso'
);
select throws_ok(
  $$insert into auth.users (id, email)
    values ('e0000000-0000-0000-0000-000000000007', 'MARIANA.SOUZA@rede.ulbra.br')$$,
  '23505', null, 'mesmo e-mail com outra caixa não cria segundo perfil'
);

-- Exclusão da conta apaga o perfil em cascata (docs/SECURITY.md, LGPD)
delete from auth.users where id = 'e0000000-0000-0000-0000-000000000004';
select is_empty(
  $$select 1 from public.usuario where id_usuario = 'e0000000-0000-0000-0000-000000000004'$$,
  'excluir o usuário do Auth apaga o perfil'
);

select * from finish();
rollback;
