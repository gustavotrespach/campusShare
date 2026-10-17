-- T18 — Buscar e detalhar caronas (US05, RN08) e a fórmula única do rateio (RN11).
-- Busca e detalhe são SECURITY DEFINER e devolvem só colunas públicas: nenhuma política nova em
-- carona, usuario ou veiculo. Uma política de carona que consultasse reserva entraria em recursão
-- com a política do motorista em reserva (que consulta carona) e exporia colunas como telefone.

-- ============================================================
-- valor_por_passageiro (RN11)
-- ============================================================

-- ÚNICA fórmula do rateio: a busca mostra este valor e a reservar_vaga (T21) cobra este mesmo
-- valor. n_ocupantes = vagas_ofertadas + 1 (o motorista entra na divisão). A sobra de centavos
-- do arredondamento fica com o motorista (ex.: 25,00 ÷ 3 = 8,33 por passageiro).
create function public.valor_por_passageiro(p_custo_total numeric, p_vagas_ofertadas int)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(p_custo_total / (p_vagas_ofertadas + 1), 2);
$$;

-- Só as funções do backend usam (elas rodam como dono); o app recebe o valor pronto.
revoke execute on function public.valor_por_passageiro(numeric, int)
  from public, anon, authenticated;

-- ============================================================
-- RPC: buscar_caronas (US05, RN08)
-- ============================================================

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
  cor text
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
    v.cor::text
  from candidatas k
  join public.usuario u on u.id_usuario = k.id_motorista
  join public.veiculo v on v.id_veiculo = k.id_veiculo
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

-- ============================================================
-- RPC: detalhar_carona
-- ============================================================

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
  sou_motorista boolean
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
    c.id_motorista = v_id_usuario
  from public.carona c
  join public.usuario u on u.id_usuario = c.id_motorista
  join public.veiculo v on v.id_veiculo = c.id_veiculo
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
