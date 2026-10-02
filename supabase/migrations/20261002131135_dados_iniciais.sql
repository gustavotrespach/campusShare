-- T07 — Dados essenciais: instituição ULBRA.
-- Fica em migration (e não no seed.sql) porque precisa existir também no remoto;
-- o on conflict torna a migration idempotente se a linha já tiver sido criada.

insert into public.instituicao (nome, dominio_email)
values ('Universidade Luterana do Brasil (ULBRA)', 'rede.ulbra.br')
on conflict (dominio_email) do nothing;
