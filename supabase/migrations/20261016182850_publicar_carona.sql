-- T17 — Publicar carona (US03, US07): único caminho para criar carona na Sprint 2, porque o app
-- não tem INSERT em carona. Valida RN04, RN05 e RN06 e as faixas da tabela antes de gravar, para
-- o app receber sempre um código do domínio (PTxxx + hint), nunca um 23514/23503 genérico.

-- ============================================================
-- RPC: publicar_carona
-- ============================================================

-- Vagas e tolerância como int (e não smallint): o PostgREST converte o JSON para o tipo do
-- parâmetro antes de chamar a função, e um número grande estouraria smallint com erro técnico
-- (22003) em vez de chegar à validação abaixo.
create function public.publicar_carona(
  p_id_veiculo uuid,
  p_origem text,
  p_origem_lat numeric,
  p_origem_lng numeric,
  p_destino text,
  p_destino_lat numeric,
  p_destino_lng numeric,
  p_data_hora_partida timestamptz,
  p_vagas_ofertadas int,
  p_custo_total numeric,
  p_tolerancia_min int,
  p_somente_mulheres boolean default false
)
returns uuid
language plpgsql
-- SECURITY DEFINER: carona não tem INSERT para authenticated; a função grava em nome do usuário
-- da sessão e, por ignorar a RLS, filtra o veículo pelo dono explicitamente.
security definer
set search_path = ''
as $$
declare
  v_id_motorista uuid := auth.uid();
  v_qtd_lugares smallint;
  v_origem text := trim(p_origem);
  v_destino text := trim(p_destino);
  v_id_carona uuid;
begin
  if v_id_motorista is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  -- RN04
  if not exists (select 1 from public.veiculo v where v.id_motorista = v_id_motorista) then
    raise exception 'SEM_VEICULO'
      using errcode = 'PT422', hint = 'Cadastre um veículo antes de oferecer uma carona.';
  end if;

  -- Veículo inexistente e veículo de outro motorista têm a mesma resposta: não revela veículos alheios
  select v.qtd_lugares
  into v_qtd_lugares
  from public.veiculo v
  where v.id_veiculo = p_id_veiculo
    and v.id_motorista = v_id_motorista;

  if v_qtd_lugares is null then
    raise exception 'VEICULO_NAO_ENCONTRADO'
      using errcode = 'PT404', hint = 'Veículo não encontrado. Escolha um dos seus veículos.';
  end if;

  -- RN05: o motorista ocupa um dos lugares
  if p_vagas_ofertadas is null or p_vagas_ofertadas < 1 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Ofereça pelo menos 1 vaga.';
  end if;
  if p_vagas_ofertadas > v_qtd_lugares - 1 then
    raise exception 'VAGAS_ACIMA_DO_LIMITE'
      using errcode = 'PT422',
        hint = format(
          'Este veículo comporta no máximo %s vagas para passageiros.', v_qtd_lugares - 1
        );
  end if;

  -- RN06
  if p_data_hora_partida is null then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Informe a data e a hora de partida.';
  end if;
  if p_data_hora_partida <= now() then
    raise exception 'PARTIDA_NO_PASSADO'
      using errcode = 'PT400', hint = 'Escolha uma data e hora de partida no futuro.';
  end if;

  -- Faixas das colunas de carona (schema_inicial), com frase para cada campo
  if v_origem is null or v_origem = '' or length(v_origem) > 200 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Informe a origem, com até 200 caracteres.';
  end if;
  if v_destino is null or v_destino = '' or length(v_destino) > 200 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Informe o destino, com até 200 caracteres.';
  end if;
  if p_origem_lat is null or p_origem_lng is null
    or p_origem_lat not between -90 and 90 or p_origem_lng not between -180 and 180 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'A localização da origem é inválida. Escolha o local de novo.';
  end if;
  if p_destino_lat is null or p_destino_lng is null
    or p_destino_lat not between -90 and 90 or p_destino_lng not between -180 and 180 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'A localização do destino é inválida. Escolha o local de novo.';
  end if;
  -- custo_total é decimal(10,2): mais de 2 casas seria arredondado sem aviso, e acima do limite
  -- da coluna daria erro técnico. Sem teto na Sprint 2 (RN12).
  if p_custo_total is null or p_custo_total <= 0 or p_custo_total >= 100000000
    or p_custo_total <> round(p_custo_total, 2) then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Informe um valor maior que zero, com até 2 casas decimais.';
  end if;
  -- US07
  if p_tolerancia_min is null or p_tolerancia_min not between 0 and 30 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'A tolerância deve ser de 0 a 30 minutos.';
  end if;

  -- RN11: vagas_ofertadas fica fixa (base do rateio); vagas_disponiveis diminui a cada reserva.
  -- custo_estimado e distancia_km ficam nulos até a sugestão de preço (Sprint 3, RN12).
  insert into public.carona (
    id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat, destino_lng,
    data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min,
    somente_mulheres, status
  )
  values (
    v_id_motorista, p_id_veiculo, v_origem, p_origem_lat, p_origem_lng, v_destino,
    p_destino_lat, p_destino_lng, p_data_hora_partida, p_vagas_ofertadas, p_vagas_ofertadas,
    p_custo_total, p_tolerancia_min,
    -- null explícito vale como "não": a SPEC não restringe quem publica (RN18 é na reserva)
    coalesce(p_somente_mulheres, false), 'ABERTA'
  )
  returning id_carona into v_id_carona;

  return v_id_carona;
end;
$$;

revoke execute on function public.publicar_carona(
  uuid, text, numeric, numeric, text, numeric, numeric, timestamptz, int, numeric, int, boolean
) from public, anon;

grant execute on function public.publicar_carona(
  uuid, text, numeric, numeric, text, numeric, numeric, timestamptz, int, numeric, int, boolean
) to authenticated;
