-- T07 — Dados essenciais: a ULBRA existe uma única vez e a migration é idempotente.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select results_eq(
  $$select count(*) from public.instituicao where dominio_email = 'rede.ulbra.br'$$,
  $$values (1::bigint)$$,
  'ULBRA cadastrada uma única vez'
);

-- Reexecuta o insert da migration dados_iniciais
select lives_ok(
  $$insert into public.instituicao (nome, dominio_email)
    values ('Universidade Luterana do Brasil (ULBRA)', 'rede.ulbra.br')
    on conflict (dominio_email) do nothing$$,
  'reaplicar o insert da ULBRA não falha'
);

select results_eq(
  $$select count(*) from public.instituicao where dominio_email = 'rede.ulbra.br'$$,
  $$values (1::bigint)$$,
  'reaplicar o insert não duplica a ULBRA'
);

select * from finish();
rollback;
