-- T43 — Início com a nota do motorista. Nova versão da buscar_caronas (a de 20261017141431 não é
-- editada): mesmos parâmetros, filtros (RN08, RN14, RN18), ordem, paginação, erros e grants, mais
-- media_motorista (1 casa, nula sem avaliações) e total_avaliacoes_motorista no fim, calculadas pela
-- resumo_avaliacoes (T30), a mesma conta do perfil_publico, do detalhar_carona e da minhas_reservas.
-- Continua sem id, e-mail, telefone ou gênero do motorista. Uma consulta para a lista toda: o app não
-- chama nada por card. O tipo de retorno muda: drop + create.

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
  total_avaliacoes_motorista int
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
    resumo.total
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
