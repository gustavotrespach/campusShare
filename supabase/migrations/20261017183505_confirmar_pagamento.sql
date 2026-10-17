-- T23 — Confirmação do pagamento pelo webhook do Mercado Pago (RN15, ADR-008).
-- Só a Edge Function webhook-mercado-pago chama, depois de validar a assinatura e consultar a
-- order na API (a decisão usa o que a API diz, nunca só o corpo da notificação).

-- ============================================================
-- confirmar_pagamento (só service_role)
-- ============================================================

-- Resultado:
--   CONFIRMADO          pagamento APROVADO e reserva CONFIRMADA agora
--   JA_CONFIRMADO       notificação repetida: nada muda (idempotência)
--   REEMBOLSO_PENDENTE  Pix pago de reserva já cancelada/expirada: registra para reembolso (T28),
--                       sem confirmar a reserva e sem mexer na vaga (caso de borda do SPEC.md)
--   IGNORADO            estado inconsistente (ex.: pagamento RECUSADO com reserva PENDENTE)
-- Vagas não mudam aqui: a vaga já foi ocupada na reservar_vaga (T21), que também aplica a LOTADA.
create function public.confirmar_pagamento(
  p_id_externo text,
  p_id_pagamento uuid,
  p_valor numeric
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_externo text := trim(p_id_externo);
  v_id_reserva uuid;
  v_id_carona uuid;
  v_pagamento public.pagamento%rowtype;
  v_status_reserva public.status_reserva;
begin
  if v_id_externo is null or v_id_externo = '' or length(v_id_externo) > 64
    or p_valor is null or p_valor <= 0 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Notificação de pagamento com dados inválidos.';
  end if;

  select p.id_reserva, r.id_carona
  into v_id_reserva, v_id_carona
  from public.pagamento p
  join public.reserva r on r.id_reserva = p.id_reserva
  where p.id_pagamento = p_id_pagamento;

  if not found then
    raise exception 'PAGAMENTO_NAO_ENCONTRADO'
      using errcode = 'PT404', hint = 'Pagamento não encontrado.';
  end if;

  -- Mesma ordem de locks da reservar_vaga e da desfazer_reserva_sem_cobranca: sem deadlock
  perform 1 from public.carona c where c.id_carona = v_id_carona for update;

  select r.status
  into v_status_reserva
  from public.reserva r
  where r.id_reserva = v_id_reserva
  for update;

  select p.*
  into v_pagamento
  from public.pagamento p
  where p.id_pagamento = p_id_pagamento
  for update;

  -- A order paga tem de ser a deste pagamento e do mesmo valor
  if v_pagamento.id_externo is not null and v_pagamento.id_externo <> v_id_externo then
    raise exception 'COBRANCA_DIVERGENTE'
      using errcode = 'PT409', hint = 'A order notificada não é a cobrança deste pagamento.';
  end if;
  if v_pagamento.valor <> p_valor then
    raise exception 'VALOR_DIVERGENTE'
      using errcode = 'PT409', hint = 'O valor pago não confere com o valor da reserva.';
  end if;

  -- Caso raro da T22: a order foi criada, mas a resposta se perdeu e a reserva foi desfeita sem
  -- id_externo. O external_reference (= id_pagamento) identifica o pagamento; grava a order agora.
  if v_pagamento.id_externo is null then
    begin
      update public.pagamento set id_externo = v_id_externo where id_pagamento = p_id_pagamento;
    exception
      when unique_violation then
        raise exception 'COBRANCA_DUPLICADA'
          using errcode = 'PT409', hint = 'Esta cobrança já pertence a outro pagamento.';
    end;
  end if;

  -- Idempotência: notificação repetida não muda nada
  if v_pagamento.status = 'APROVADO' then
    return 'JA_CONFIRMADO';
  end if;
  if v_pagamento.status = 'REEMBOLSO_PENDENTE' then
    return 'REEMBOLSO_PENDENTE';
  end if;

  if v_status_reserva = 'PENDENTE' and v_pagamento.status = 'PENDENTE' then
    update public.pagamento
    set status = 'APROVADO', pago_em = now()
    where id_pagamento = p_id_pagamento;
    -- RN15: só aqui a reserva vira CONFIRMADA (ADR-008)
    update public.reserva set status = 'CONFIRMADA' where id_reserva = v_id_reserva;
    return 'CONFIRMADO';
  end if;

  -- Reserva desfeita (cobrança falhou na T22) ou expirada (T24), mas o Pix foi pago: o dinheiro
  -- precisa voltar ao passageiro. A vaga não é mexida (já foi devolvida ou ocupada por outro).
  if v_status_reserva in ('CANCELADA', 'EXPIRADA') then
    update public.pagamento
    set status = 'REEMBOLSO_PENDENTE', pago_em = now()
    where id_pagamento = p_id_pagamento;
    return 'REEMBOLSO_PENDENTE';
  end if;

  return 'IGNORADO';
end;
$$;

revoke execute on function public.confirmar_pagamento(text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(text, uuid, numeric) to service_role;
