-- T44 (Parte A) — Foto de perfil opcional (LGPD: opcional, removível, visível só para quem está
-- logado; sem foto, o app mostra as iniciais).
-- • usuario.foto_atualizada_em: null = sem foto. O arquivo fica num caminho fixo do Storage,
--   <id_usuario>/avatar.jpg, no bucket privado fotos-perfil. O app não escreve a coluna: ela fica
--   fora do grant de UPDATE por coluna da T06 e só muda pelas RPCs definir_foto_perfil e
--   remover_foto_perfil. A leitura já vem do grant de SELECT da tabela (RLS: a própria linha).
-- • Bucket criado por SQL (e não pelo [storage.buckets] do config.toml: o config push de Storage
--   dá 402 no plano gratuito, docs/DEPLOY.md), com políticas em storage.objects só para ele.
-- • perfil_publico, detalhar_carona e buscar_caronas ganham o caminho da foto no fim (nova versão,
--   drop + create; o contrato anterior fica igual). O caminho contém o id do usuário: só quem está
--   logado o recebe, e a RLS do Storage protege a escrita (docs/SECURITY.md).

-- ============================================================
-- Coluna
-- ============================================================

alter table public.usuario add column foto_atualizada_em timestamptz;

comment on column public.usuario.foto_atualizada_em is
  'Quando a foto de perfil (fotos-perfil/<id_usuario>/avatar.jpg) foi definida; null = sem foto. '
  'Só muda pelas funções definir_foto_perfil e remover_foto_perfil.';

-- ============================================================
-- Bucket fotos-perfil: privado, até 1 MB, só JPEG
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- ============================================================
-- Políticas em storage.objects (só para o bucket fotos-perfil; nada para anon)
-- ============================================================

-- Qualquer usuário logado vê a foto dos outros (card do motorista, perfil público)
create policy "logados leem as fotos de perfil"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-perfil');

-- Escrita só no próprio caminho fixo: <auth.uid()>/avatar.jpg (o upsert do app usa INSERT + UPDATE)
create policy "usuário envia a própria foto de perfil"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-perfil'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

create policy "usuário troca a própria foto de perfil"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and name = (select auth.uid())::text || '/avatar.jpg'
  )
  with check (
    bucket_id = 'fotos-perfil'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

create policy "usuário apaga a própria foto de perfil"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and name = (select auth.uid())::text || '/avatar.jpg'
  );

-- ============================================================
-- caminho_foto_perfil (interna)
-- ============================================================

-- "<id>/avatar.jpg?v=<época>": o ?v= muda a cada troca e evita que o app mostre a foto antiga do
-- cache. Sem foto: null. Uma conta só, usada pelas três funções de leitura.
create function public.caminho_foto_perfil(p_id_usuario uuid, p_foto_atualizada_em timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_foto_atualizada_em is null then null
    else p_id_usuario::text || '/avatar.jpg?v='
      || extract(epoch from p_foto_atualizada_em)::bigint::text
  end
$$;

revoke execute on function public.caminho_foto_perfil(uuid, timestamptz)
  from public, anon, authenticated;

-- ============================================================
-- RPC: definir_foto_perfil
-- ============================================================

-- Depois do upload: confere que o arquivo existe no caminho fixo e grava a data (que vira o ?v=)
create function public.definir_foto_perfil()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_agora timestamptz := now();
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'fotos-perfil'
      and o.name = v_id_usuario::text || '/avatar.jpg'
  ) then
    raise exception 'FOTO_NAO_ENVIADA'
      using errcode = 'PT409', hint = 'A foto não chegou ao servidor. Tente enviar de novo.';
  end if;

  update public.usuario
  set foto_atualizada_em = v_agora
  where id_usuario = v_id_usuario;

  return v_agora;
end;
$$;

revoke execute on function public.definir_foto_perfil() from public, anon;
grant execute on function public.definir_foto_perfil() to authenticated;

-- ============================================================
-- RPC: remover_foto_perfil
-- ============================================================

-- O app apaga o arquivo pela API do Storage antes (a política de DELETE acima); aqui só a coluna.
-- Linhas de storage.objects não são apagadas por SQL: o arquivo no disco ficaria órfão.
create function public.remover_foto_perfil()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  update public.usuario
  set foto_atualizada_em = null
  where id_usuario = v_id_usuario;
end;
$$;

revoke execute on function public.remover_foto_perfil() from public, anon;
grant execute on function public.remover_foto_perfil() to authenticated;

-- ============================================================
-- perfil_publico com a foto (versão da T30 + foto_caminho no fim)
-- ============================================================

drop function public.perfil_publico(uuid);

create function public.perfil_publico(p_id_usuario uuid)
returns table (
  id_usuario uuid,
  nome text,
  media_avaliacoes numeric,
  total_avaliacoes int,
  foto_caminho text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  return query
  select
    u.id_usuario,
    u.nome_completo::text,
    resumo.media,
    resumo.total,
    public.caminho_foto_perfil(u.id_usuario, u.foto_atualizada_em)
  from public.usuario u
  cross join lateral public.resumo_avaliacoes(u.id_usuario) resumo
  where u.id_usuario = p_id_usuario;

  if not found then
    raise exception 'USUARIO_NAO_ENCONTRADO'
      using errcode = 'PT404', hint = 'Usuário não encontrado.';
  end if;
end;
$$;

revoke execute on function public.perfil_publico(uuid) from public, anon;
grant execute on function public.perfil_publico(uuid) to authenticated;

-- ============================================================
-- detalhar_carona com a foto do motorista (versão da T30 + foto_motorista no fim)
-- ============================================================

drop function public.detalhar_carona(uuid);

create function public.detalhar_carona(p_id_carona uuid)
returns table (
  id_carona uuid,
  origem text,
  origem_lat numeric,
  origem_lng numeric,
  destino text,
  destino_lat numeric,
  destino_lng numeric,
  data_hora_partida timestamptz,
  vagas_disponiveis int,
  vagas_ofertadas int,
  tolerancia_min int,
  somente_mulheres boolean,
  status public.status_carona,
  custo_total numeric,
  valor_por_passageiro numeric,
  nome_motorista text,
  modelo text,
  cor text,
  placa text,
  sou_motorista boolean,
  media_motorista numeric,
  total_avaliacoes_motorista int,
  foto_motorista text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id_usuario uuid := auth.uid();
  v_feminina boolean;
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  select u.genero = 'FEMININO'
  into v_feminina
  from public.usuario u
  where u.id_usuario = v_id_usuario;
  v_feminina := coalesce(v_feminina, false);

  return query
  select
    c.id_carona,
    c.origem::text,
    c.origem_lat,
    c.origem_lng,
    c.destino::text,
    c.destino_lat,
    c.destino_lng,
    c.data_hora_partida,
    c.vagas_disponiveis::int,
    c.vagas_ofertadas::int,
    c.tolerancia_min::int,
    c.somente_mulheres,
    c.status,
    c.custo_total,
    public.valor_por_passageiro(c.custo_total, c.vagas_ofertadas),
    -- Perfil público (docs/API.md): nome completo, sem e-mail nem telefone
    u.nome_completo::text,
    v.modelo::text,
    v.cor::text,
    -- A placa ajuda o passageiro a reconhecer o carro no embarque
    v.placa::text,
    c.id_motorista = v_id_usuario,
    -- Reputação do motorista (T30): média com 1 casa (nula sem avaliações) e total
    resumo.media,
    resumo.total,
    -- Foto do motorista (T44): caminho no bucket fotos-perfil com ?v=, ou null sem foto
    public.caminho_foto_perfil(u.id_usuario, u.foto_atualizada_em)
  from public.carona c
  join public.usuario u on u.id_usuario = c.id_motorista
  join public.veiculo v on v.id_veiculo = c.id_veiculo
  cross join lateral public.resumo_avaliacoes(c.id_motorista) resumo
  where c.id_carona = p_id_carona
    and (
      -- O motorista vê a própria carona em qualquer status
      c.id_motorista = v_id_usuario
      -- Quem tem reserva (qualquer status) acompanha a carona (T25)
      or exists (
        select 1 from public.reserva r
        where r.id_carona = c.id_carona and r.id_passageiro = v_id_usuario
      )
      -- Os demais, só o que a busca mostraria: ABERTA, futura e, se somente_mulheres, usuária
      or (
        c.status = 'ABERTA'
        and c.data_hora_partida > now()
        and (not c.somente_mulheres or v_feminina)
      )
    );

  -- Inexistente e invisível têm a mesma resposta: não revela caronas fora do alcance do usuário
  if not found then
    raise exception 'CARONA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Carona não encontrada ou não está mais disponível.';
  end if;
end;
$$;

revoke execute on function public.detalhar_carona(uuid) from public, anon;
grant execute on function public.detalhar_carona(uuid) to authenticated;

-- ============================================================
-- buscar_caronas com a foto do motorista (versão da T43 + foto_motorista no fim)
-- ============================================================

drop function public.buscar_caronas(numeric, numeric, numeric, boolean, date, int);

create function public.buscar_caronas(
  p_lat numeric,
  p_lng numeric,
  p_raio_km numeric default 10,
  p_somente_mulheres boolean default false,
  p_data date default null,
  p_pagina int default 1
)
returns table (
  id_carona uuid,
  origem text,
  origem_lat numeric,
  origem_lng numeric,
  destino text,
  destino_lat numeric,
  destino_lng numeric,
  data_hora_partida timestamptz,
  vagas_disponiveis int,
  tolerancia_min int,
  somente_mulheres boolean,
  distancia_km numeric,
  valor_por_passageiro numeric,
  nome_motorista text,
  modelo text,
  cor text,
  media_motorista numeric,
  total_avaliacoes_motorista int,
  foto_motorista text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id_usuario uuid := auth.uid();
  v_feminina boolean;
  -- 1 grau de latitude ≈ 111 km; o de longitude encolhe com o cosseno da latitude
  v_delta_lat numeric;
  v_delta_lng numeric;
  v_tamanho_pagina constant int := 20;
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  if p_lat is null or p_lng is null or p_lat not between -90 and 90
    or p_lng not between -180 and 180 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Sua localização é inválida. Tente de novo.';
  end if;
  if p_raio_km is null or p_raio_km not between 1 and 50 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'O raio da busca deve ser de 1 a 50 km.';
  end if;
  if p_pagina is null or p_pagina < 1 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Página inválida.';
  end if;

  -- RN18: carona somente_mulheres só aparece para quem pode reservá-la
  select u.genero = 'FEMININO'
  into v_feminina
  from public.usuario u
  where u.id_usuario = v_id_usuario;
  v_feminina := coalesce(v_feminina, false);

  v_delta_lat := p_raio_km / 111.045;
  v_delta_lng := p_raio_km / (111.045 * greatest(cos(radians(p_lat::float8)), 0.01)::numeric);

  return query
  with candidatas as (
    select
      c.id_carona, c.id_motorista, c.id_veiculo, c.origem, c.origem_lat, c.origem_lng,
      c.destino, c.destino_lat, c.destino_lng, c.data_hora_partida, c.vagas_disponiveis,
      c.vagas_ofertadas, c.tolerancia_min, c.somente_mulheres, c.custo_total,
      -- Haversine (raio da Terra 6371 km); least() protege o asin de erro de arredondamento
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians((c.origem_lat - p_lat)::float8) / 2), 2)
        + cos(radians(p_lat::float8)) * cos(radians(c.origem_lat::float8))
          * power(sin(radians((c.origem_lng - p_lng)::float8) / 2), 2)
      ))) as km
    from public.carona c
    where c.status = 'ABERTA'
      and c.vagas_disponiveis > 0
      and c.data_hora_partida > now()
      -- RN14: o motorista não reserva a própria carona; ela já aparece na lista dele
      and c.id_motorista <> v_id_usuario
      -- Bounding box primeiro (usa o índice de origem_lat/origem_lng), haversine depois
      and c.origem_lat between p_lat - v_delta_lat and p_lat + v_delta_lat
      and c.origem_lng between p_lng - v_delta_lng and p_lng + v_delta_lng
      and (not c.somente_mulheres or v_feminina)
      and (not coalesce(p_somente_mulheres, false) or c.somente_mulheres)
      -- O dia é o de Brasília: 23:30 do dia 20 em Brasília é 02:30 do dia 21 em UTC
      and (p_data is null
        or (c.data_hora_partida at time zone 'America/Sao_Paulo')::date = p_data)
  )
  select
    k.id_carona,
    k.origem::text,
    k.origem_lat,
    k.origem_lng,
    k.destino::text,
    k.destino_lat,
    k.destino_lng,
    k.data_hora_partida,
    k.vagas_disponiveis::int,
    k.tolerancia_min::int,
    k.somente_mulheres,
    round(k.km::numeric, 1),
    public.valor_por_passageiro(k.custo_total, k.vagas_ofertadas),
    -- Na lista, só o primeiro nome; o nome completo fica no detalhe
    split_part(trim(u.nome_completo), ' ', 1),
    v.modelo::text,
    v.cor::text,
    resumo.media,
    resumo.total,
    -- Foto do motorista (T44): caminho no bucket fotos-perfil com ?v=, ou null sem foto
    public.caminho_foto_perfil(u.id_usuario, u.foto_atualizada_em)
  from candidatas k
  join public.usuario u on u.id_usuario = k.id_motorista
  join public.veiculo v on v.id_veiculo = k.id_veiculo
  -- Mesma conta do perfil_publico, do detalhar_carona e da minhas_reservas (T30/T42)
  cross join lateral public.resumo_avaliacoes(k.id_motorista) resumo
  where k.km <= p_raio_km
  order by k.km, k.data_hora_partida, k.id_carona
  limit v_tamanho_pagina
  offset (p_pagina - 1)::bigint * v_tamanho_pagina;
end;
$$;

revoke execute on function public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)
  from public, anon;
grant execute on function public.buscar_caronas(numeric, numeric, numeric, boolean, date, int)
  to authenticated;
