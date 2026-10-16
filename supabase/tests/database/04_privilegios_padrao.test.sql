-- Privilégios padrão: tabela, sequence e função criadas depois da migration privilegios_padrao
-- não dão acesso a anon/authenticated sem GRANT explícito; service_role mantém o acesso.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Objetos criados pelo postgres, como numa migration futura
create table public.teste_privilegios (
  id int generated always as identity primary key,
  valor int
);
create function public.teste_privilegios_funcao() returns int language sql as 'select 1';

select ok(
  not has_table_privilege(
    'anon', 'public.teste_privilegios', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
  ),
  'tabela nova: anon sem nenhum privilégio'
);
select ok(
  not has_table_privilege(
    'authenticated', 'public.teste_privilegios',
    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
  ),
  'tabela nova: authenticated sem nenhum privilégio'
);
select ok(
  not has_sequence_privilege(
    'anon', pg_get_serial_sequence('public.teste_privilegios', 'id'), 'USAGE, SELECT, UPDATE'
  ),
  'sequence nova: anon sem nenhum privilégio'
);
select ok(
  not has_sequence_privilege(
    'authenticated', pg_get_serial_sequence('public.teste_privilegios', 'id'),
    'USAGE, SELECT, UPDATE'
  ),
  'sequence nova: authenticated sem nenhum privilégio'
);
select ok(
  not has_function_privilege('anon', 'public.teste_privilegios_funcao()', 'execute'),
  'função nova: anon não executa (nem via PUBLIC)'
);
select ok(
  not has_function_privilege('authenticated', 'public.teste_privilegios_funcao()', 'execute'),
  'função nova: authenticated não executa'
);
select ok(
  has_table_privilege('service_role', 'public.teste_privilegios', 'SELECT, INSERT'),
  'tabela nova: service_role mantém o acesso padrão'
);

-- Com GRANT explícito o acesso volta (a regra é conceder só o necessário, não bloquear tudo)
grant select on public.teste_privilegios to authenticated;
grant execute on function public.teste_privilegios_funcao() to authenticated;

select ok(
  has_table_privilege('authenticated', 'public.teste_privilegios', 'SELECT')
    and not has_table_privilege('authenticated', 'public.teste_privilegios', 'INSERT'),
  'GRANT explícito concede só o privilégio pedido'
);
select ok(
  has_function_privilege('authenticated', 'public.teste_privilegios_funcao()', 'execute')
    and not has_function_privilege('anon', 'public.teste_privilegios_funcao()', 'execute'),
  'GRANT EXECUTE explícito vale só para o papel concedido'
);

select * from finish();
rollback;
