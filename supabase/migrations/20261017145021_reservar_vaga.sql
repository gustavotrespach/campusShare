-- T21 — Reserva com rateio (US04): único caminho para criar reserva. Em uma transação, com a
-- carona travada (FOR UPDATE), valida RN08, RN14 e RN18, grava a reserva PENDENTE com o rateio
-- (RN11) e o pagamento PENDENTE com a taxa (RN13), e baixa a vaga (RN07, RN17).

-- ============================================================
-- reservar_vaga (só service_role)
-- ============================================================

-- Chamada pela Edge Function reservar-vaga (T22), nunca direto pelo app: assim nenhuma reserva
-- nasce sem cobrança. p_id_passageiro é o usuário do JWT validado pela Edge Function, NUNCA um
-- valor do corpo enviado pelo app (AGENTS.md). A cobrança Pix (id_externo) é gravada depois, pela
-- T22, no pagamento criado aqui: todo cálculo de dinheiro fica nesta função.
create function public.reservar_vaga(p_id_carona uuid, p_id_passageiro uuid)
returns table (
  id_reserva uuid,
  id_pagamento uuid,
  valor_individual numeric,
  taxa_plataforma numeric,
  valor_repassado numeric,
  status public.status_reserva
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_carona public.carona%rowtype;
  v_genero public.genero_usuario;
  v_percentual_taxa numeric;
  v_valor numeric;
  v_taxa numeric;
  v_id_reserva uuid;
  v_id_pagamento uuid;
begin
  -- RN17: trava a carona até o fim da transação; uma segunda reserva simultânea espera aqui e
  -- depois enxerga as vagas já atualizadas por esta
  select c.*
  into v_carona
  from public.carona c
  where c.id_carona = p_id_carona
  for update;

  if not found then
    raise exception 'CARONA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Carona não encontrada ou não está mais disponível.';
  end if;

  select u.genero
  into v_genero
  from public.usuario u
  where u.id_usuario = p_id_passageiro;

  if not found then
    raise exception 'USUARIO_NAO_ENCONTRADO'
      using errcode = 'PT404', hint = 'Não encontramos seu perfil. Saia e entre novamente.';
  end if;

  -- RN14
  if v_carona.id_motorista = p_id_passageiro then
    raise exception 'RESERVA_PROPRIA_CARONA'
      using errcode = 'PT422', hint = 'Você não pode reservar uma vaga na sua própria carona.';
  end if;

  -- RN18
  if v_carona.somente_mulheres and v_genero <> 'FEMININO' then
    raise exception 'CARONA_SOMENTE_MULHERES'
      using errcode = 'PT403', hint = 'Esta carona é exclusiva para mulheres.';
  end if;

  -- RN08: cancelada, concluída ou com partida já passada não aceita reserva (mesmo se LOTADA)
  if v_carona.status in ('CANCELADA', 'CONCLUIDA') or v_carona.data_hora_partida <= now() then
    raise exception 'CARONA_INDISPONIVEL'
      using errcode = 'PT409', hint = 'Esta carona não está mais disponível para reserva.';
  end if;
  if v_carona.status = 'LOTADA' or v_carona.vagas_disponiveis <= 0 then
    raise exception 'CARONA_LOTADA'
      using errcode = 'PT409', hint = 'Esta carona não tem mais vagas.';
  end if;

  -- RN14: uma reserva ativa por passageiro por carona
  if exists (
    select 1
    from public.reserva r
    where r.id_carona = p_id_carona
      and r.id_passageiro = p_id_passageiro
      and r.status in ('PENDENTE', 'CONFIRMADA')
  ) then
    raise exception 'RESERVA_DUPLICADA'
      using errcode = 'PT409', hint = 'Você já tem uma reserva nesta carona.';
  end if;

  -- RN11: a mesma fórmula que a busca mostra (não reescrever aqui)
  v_valor := public.valor_por_passageiro(v_carona.custo_total, v_carona.vagas_ofertadas);
  -- Carona com custo menor que 1 centavo por ocupante: a reserva não teria valor a cobrar
  if v_valor < 0.01 then
    raise exception 'VALOR_ABAIXO_DO_MINIMO'
      using errcode = 'PT422', hint = 'O valor por passageiro desta carona é menor que R$ 0,01.';
  end if;

  -- RN13: taxa do parâmetro vigente (o mais recente)
  select pc.percentual_taxa
  into v_percentual_taxa
  from public.parametro_custo pc
  order by pc.atualizado_em desc, pc.id_parametro desc
  limit 1;

  if v_percentual_taxa is null then
    raise exception 'PARAMETRO_AUSENTE'
      using errcode = 'PT500', hint = 'Não foi possível calcular o valor agora. Tente mais tarde.';
  end if;

  v_taxa := round(v_valor * v_percentual_taxa, 2);

  begin
    insert into public.reserva (id_carona, id_passageiro, valor_individual, status)
    values (p_id_carona, p_id_passageiro, v_valor, 'PENDENTE')
    returning id_reserva into v_id_reserva;
  exception
    -- Duas chamadas do mesmo passageiro ao mesmo tempo: o índice único parcial decide
    when unique_violation then
      raise exception 'RESERVA_DUPLICADA'
        using errcode = 'PT409', hint = 'Você já tem uma reserva nesta carona.';
  end;

  insert into public.pagamento (
    id_reserva, valor, taxa_plataforma, valor_repassado, metodo, status
  )
  values (v_id_reserva, v_valor, v_taxa, v_valor - v_taxa, 'PIX', 'PENDENTE')
  returning id_pagamento into v_id_pagamento;

  -- RN07: a reserva PENDENTE já ocupa a vaga (a expiração que devolve a vaga é a T24)
  update public.carona c
  set vagas_disponiveis = c.vagas_disponiveis - 1,
      status = case when c.vagas_disponiveis - 1 = 0 then 'LOTADA' else c.status end
  where c.id_carona = p_id_carona;

  return query
  select v_id_reserva, v_id_pagamento, v_valor, v_taxa, v_valor - v_taxa,
    'PENDENTE'::public.status_reserva;
end;
$$;

revoke execute on function public.reservar_vaga(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reservar_vaga(uuid, uuid) to service_role;
