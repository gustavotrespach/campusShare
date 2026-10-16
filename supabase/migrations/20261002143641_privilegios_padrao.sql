-- Privilégios padrão: objetos novos criados pelo postgres (migrations) nascem sem acesso para o app.
-- O Supabase concede tudo a anon/authenticated em public por padrão; com isto, cada migration
-- precisa conceder explicitamente o mínimo (grant select/update..., grant execute) a quem usa.
-- service_role mantém os privilégios padrão: só existe nas Edge Functions (docs/SECURITY.md).

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- O EXECUTE para PUBLIC em funções é um padrão global do PostgreSQL, que um "in schema" não
-- consegue revogar: sem esta linha, anon continuaria executando toda função nova via PUBLIC.
-- Vale para funções criadas pelo postgres em qualquer schema.
alter default privileges for role postgres
  revoke execute on functions from public;
