-- T28 — Cancelamento de reserva (passageiro) e de carona (motorista): US06, RN07, RN17, RN20.
-- As duas funções travam primeiro a carona, depois a(s) reserva(s) e o(s) pagamento(s), a mesma
-- ordem da reservar_vaga, da confirmar_pagamento e da expirar_reservas (sem deadlock com o webhook
-- nem com o job), e conferem o status de novo depois do lock.
-- Pagamento APROVADO de reserva cancelada vira REEMBOLSO_PENDENTE (o reembolso em si é manual por
-- enquanto); Pix pago depois do cancelamento cai na confirmar_pagamento como REEMBOLSO_PENDENTE.

-- ============================================================
-- prazo_cancelamento_confirmada
-- ============================================================

-- RN20: reserva CONFIRMADA (já paga) só é cancelada pelo passageiro até este tempo antes da partida
-- (decisão do Gustavo, 23/11/2026). Único lugar do prazo.
create function public.prazo_cancelamento_confirmada()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '2 hours'
$$;

revoke execute on function public.prazo_cancelamento_confirmada() from public, anon, authenticated;
grant execute on function public.prazo_cancelamento_confirmada() to service_role;

-- ============================================================
-- cancelar_reserva (passageiro)
-- ============================================================

-- O passageiro do auth.uid() cancela a própria reserva. PENDENTE: até a partida, pagamento RECUSADO.
-- CONFIRMADA: até o prazo da RN20 antes da partida, pagamento APROVADO → REEMBOLSO_PENDENTE. Nos dois
-- casos a vaga volta e a carona LOTADA reabre (RN17). Devolve o status final da reserva.
create function public.cancelar_reserva(p_id_reserva uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_id_carona uuid;
  v_carona public.carona%rowtype;
  v_reserva public.reserva%rowtype;
  v_prazo interval := public.prazo_cancelamento_confirmada();
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  -- Só para saber qual carona travar; a decisão vale depois dos locks
  select r.id_carona
  into v_id_carona
  from public.reserva r
  where r.id_reserva = p_id_reserva
    and r.id_passageiro = v_id_usuario;

  -- Inexistente e de outro usuário têm a mesma resposta: não revela reservas alheias
  if not found then
    raise exception 'RESERVA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Reserva não encontrada.';
  end if;

  -- 1º a carona
  select c.*
  into v_carona
  from public.carona c
  where c.id_carona = v_id_carona
  for update;

  -- 2º a reserva, conferida de novo depois do lock
  select r.*
  into v_reserva
  from public.reserva r
  where r.id_reserva = p_id_reserva
    and r.id_passageiro = v_id_usuario
  for update;

  if not found then
    raise exception 'RESERVA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Reserva não encontrada.';
  end if;

  if v_reserva.status in ('CANCELADA', 'EXPIRADA') then
    raise exception 'RESERVA_JA_ENCERRADA'
      using errcode = 'PT409', hint = 'Esta reserva já foi cancelada ou expirou.';
  end if;

  if v_carona.status in ('CANCELADA', 'CONCLUIDA') or v_carona.data_hora_partida <= now() then
    raise exception 'CANCELAMENTO_ENCERRADO'
      using errcode = 'PT409', hint = 'Esta carona já partiu ou foi encerrada; não dá mais para cancelar.';
  end if;

  -- RN20
  if v_reserva.status = 'CONFIRMADA' and v_carona.data_hora_partida - now() < v_prazo then
    raise exception 'PRAZO_CANCELAMENTO_ENCERRADO'
      using errcode = 'PT409',
            hint = format(
              'Reservas pagas só podem ser canceladas até %s horas antes da partida.',
              extract(epoch from v_prazo)::int / 3600
            );
  end if;

  -- 3º o pagamento
  perform 1 from public.pagamento p where p.id_reserva = p_id_reserva for update;

  update public.reserva set status = 'CANCELADA' where id_reserva = p_id_reserva;

  -- PENDENTE nunca foi pago: recusado. APROVADO: o dinheiro volta ao passageiro (RN20)
  update public.pagamento
  set status = case status
                 when 'PENDENTE' then 'RECUSADO'::public.status_pagamento
                 when 'APROVADO' then 'REEMBOLSO_PENDENTE'::public.status_pagamento
                 else status
               end
  where id_reserva = p_id_reserva;

  update public.carona c
  set vagas_disponiveis = c.vagas_disponiveis + 1,
      status = case when c.status = 'LOTADA' then 'ABERTA' else c.status end
  where c.id_carona = v_id_carona;

  return 'CANCELADA';
end;
$$;

revoke execute on function public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

-- ============================================================
-- cancelar_carona (motorista)
-- ============================================================

-- O motorista do auth.uid() cancela a própria carona antes da partida (RN07, sem o prazo da RN20).
-- Toda reserva PENDENTE ou CONFIRMADA vira CANCELADA, com o pagamento PENDENTE → RECUSADO e APROVADO
-- → REEMBOLSO_PENDENTE. vagas_disponiveis não muda: a carona cancelada não volta a aceitar reserva.
-- Devolve quantas reservas cancelou.
create function public.cancelar_carona(p_id_carona uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_carona public.carona%rowtype;
  v_ids_reserva uuid[];
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  -- 1º a carona
  select c.*
  into v_carona
  from public.carona c
  where c.id_carona = p_id_carona
    and c.id_motorista = v_id_usuario
  for update;

  -- Inexistente e de outro motorista têm a mesma resposta
  if not found then
    raise exception 'CARONA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Carona não encontrada.';
  end if;

  if v_carona.status not in ('ABERTA', 'LOTADA') or v_carona.data_hora_partida <= now() then
    raise exception 'CANCELAMENTO_ENCERRADO'
      using errcode = 'PT409', hint = 'Esta carona já partiu ou foi encerrada; não dá mais para cancelar.';
  end if;

  -- 2º as reservas ativas (ordem fixa por id), 3º os pagamentos delas
  select coalesce(array_agg(r.id_reserva order by r.id_reserva), '{}')
  into v_ids_reserva
  from (
    select r.id_reserva
    from public.reserva r
    where r.id_carona = p_id_carona
      and r.status in ('PENDENTE', 'CONFIRMADA')
    order by r.id_reserva
    for update
  ) r;

  perform 1
  from public.pagamento p
  where p.id_reserva = any (v_ids_reserva)
  order by p.id_reserva
  for update;

  update public.carona set status = 'CANCELADA' where id_carona = p_id_carona;

  update public.reserva set status = 'CANCELADA' where id_reserva = any (v_ids_reserva);

  update public.pagamento
  set status = case status
                 when 'PENDENTE' then 'RECUSADO'::public.status_pagamento
                 when 'APROVADO' then 'REEMBOLSO_PENDENTE'::public.status_pagamento
                 else status
               end
  where id_reserva = any (v_ids_reserva);

  return coalesce(array_length(v_ids_reserva, 1), 0);
end;
$$;

revoke execute on function public.cancelar_carona(uuid) from public, anon;
grant execute on function public.cancelar_carona(uuid) to authenticated;
