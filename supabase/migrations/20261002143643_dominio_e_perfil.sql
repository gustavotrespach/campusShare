-- T09 — Cadastro restrito ao domínio institucional (RN01) e perfil criado automaticamente.
-- validar_dominio_institucional: Auth Hook "Before User Created" (configurado em config.toml).
-- criar_perfil_usuario: trigger AFTER INSERT em auth.users que cria a linha de public.usuario.

-- ============================================================
-- Auth Hook: validar_dominio_institucional
-- ============================================================

-- Executada pelo Supabase Auth (supabase_auth_admin) antes de criar o usuário. Retornar '{}'
-- libera o cadastro; retornar { error: { http_code, message } } recusa com esse status.
create function public.validar_dominio_institucional(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(event -> 'user' ->> 'email'));
  -- Domínio exato depois do último '@': 'aluno@rede.ulbra.br.fake.com' não casa com 'rede.ulbra.br'
  v_dominio text := substring(v_email from '@([^@]+)$');
begin
  if exists (select 1 from public.instituicao i where i.dominio_email = v_dominio) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 422, 'message', 'DOMINIO_INVALIDO')
  );
end;
$$;

revoke execute on function public.validar_dominio_institucional(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.validar_dominio_institucional(jsonb) to supabase_auth_admin;

-- ============================================================
-- Trigger: criar_perfil_usuario
-- ============================================================

create function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(new.email));
  v_metadados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_genero text := upper(trim(v_metadados ->> 'genero'));
  v_id_instituicao int;
begin
  select i.id_instituicao
  into v_id_instituicao
  from public.instituicao i
  where i.dominio_email = substring(v_email from '@([^@]+)$');

  -- O hook já recusou o domínio no cadastro; isto cobre usuários criados por fora dele
  -- (painel, Admin API, SQL), para nunca existir conta sem instituição.
  if v_id_instituicao is null then
    raise exception 'DOMINIO_INVALIDO'
      using errcode = 'PT422', hint = 'Use seu e-mail institucional.';
  end if;

  insert into public.usuario (
    id_usuario, id_instituicao, nome_completo, email_institucional, genero, telefone
  )
  values (
    new.id,
    v_id_instituicao,
    -- Sem nome nos metadados, usa a parte antes do '@'; o usuário corrige no perfil (T13)
    coalesce(nullif(trim(v_metadados ->> 'nome_completo'), ''), split_part(v_email, '@', 1)),
    v_email,
    -- Gênero ausente ou fora do enum vira NAO_INFORMADO, em vez de impedir o cadastro
    case
      when v_genero = any (enum_range(null::public.genero_usuario)::text[])
        then v_genero::public.genero_usuario
      else 'NAO_INFORMADO'::public.genero_usuario
    end,
    nullif(trim(v_metadados ->> 'telefone'), '')
  );

  return new;
end;
$$;

-- Função de trigger: ninguém a chama diretamente (o trigger não exige EXECUTE em tempo de execução)
revoke execute on function public.criar_perfil_usuario()
  from public, anon, authenticated, service_role;

create trigger criar_perfil_usuario
  after insert on auth.users
  for each row
  execute function public.criar_perfil_usuario();
