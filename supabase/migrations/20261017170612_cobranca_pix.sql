-- T22 — Cobrança Pix da reserva: funções que a Edge Function reservar-vaga chama depois da
-- reservar_vaga (T21). registrar_cobranca liga a order do Mercado Pago ao pagamento já criado;
-- desfazer_reserva_sem_cobranca devolve a vaga quando a cobrança não pôde ser criada.
-- As duas são só da service_role: o app nunca as chama.

-- ============================================================
-- registrar_cobranca
-- ============================================================

-- Grava o id da order (id_externo) no pagamento PENDENTE criado pela reservar_vaga. Idempotente:
-- repetir o mesmo id não muda nada; um id diferente é recusado (o pagamento já tem cobrança).
create function public.registrar_cobranca(p_id_pagamento uuid, p_id_externo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_externo_atual text;
  v_status public.status_pagamento;
  v_id_externo text := trim(p_id_externo);
begin
  if v_id_externo is null or v_id_externo = '' or length(v_id_externo) > 64 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'Identificador da cobrança inválido.';
  end if;

  select p.id_externo, p.status
  into v_id_externo_atual, v_status
  from public.pagamento p
  where p.id_pagamento = p_id_pagamento
  for update;

  if not found then
    raise exception 'PAGAMENTO_NAO_ENCONTRADO'
      using errcode = 'PT404', hint = 'Pagamento não encontrado.';
  end if;

  if v_id_externo_atual = v_id_externo then
    return;
  end if;

  if v_id_externo_atual is not null then
    raise exception 'COBRANCA_DIVERGENTE'
      using errcode = 'PT409', hint = 'Este pagamento já tem outra cobrança registrada.';
  end if;

  -- Reserva desfeita (pagamento RECUSADO) não volta a ter cobrança
  if v_status <> 'PENDENTE' then
    raise exception 'PAGAMENTO_ENCERRADO'
      using errcode = 'PT409', hint = 'Este pagamento não está mais pendente.';
  end if;

  begin
    update public.pagamento
    set id_externo = v_id_externo
    where id_pagamento = p_id_pagamento;
  exception
    -- id_externo é UNIQUE: a mesma order não pode pagar duas reservas
    when unique_violation then
      raise exception 'COBRANCA_DUPLICADA'
        using errcode = 'PT409', hint = 'Esta cobrança já pertence a outro pagamento.';
  end;
end;
$$;

revoke execute on function public.registrar_cobranca(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_cobranca(uuid, text) to service_role;

-- ============================================================
-- desfazer_reserva_sem_cobranca
-- ============================================================

-- A cobrança Pix falhou (erro, timeout ou resposta sem QR): a reserva PENDENTE criada pela
-- reservar_vaga não pode prender a vaga. Cancela a reserva, recusa o pagamento e devolve a vaga,
-- numa transação com a carona travada (RN17), na mesma ordem de locks da reservar_vaga.
-- Só age se a reserva ainda estiver PENDENTE e o pagamento sem cobrança; devolve true se agiu.
create function public.desfazer_reserva_sem_cobranca(p_id_reserva uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_carona uuid;
  v_status_reserva public.status_reserva;
  v_id_pagamento uuid;
  v_status_pagamento public.status_pagamento;
  v_id_externo text;
begin
  select r.id_carona
  into v_id_carona
  from public.reserva r
  where r.id_reserva = p_id_reserva;

  if not found then
    return false;
  end if;

  -- Primeiro a carona (como na reservar_vaga), depois reserva e pagamento: sem deadlock
  perform 1 from public.carona c where c.id_carona = v_id_carona for update;

  select r.status
  into v_status_reserva
  from public.reserva r
  where r.id_reserva = p_id_reserva
  for update;

  select p.id_pagamento, p.status, p.id_externo
  into v_id_pagamento, v_status_pagamento, v_id_externo
  from public.pagamento p
  where p.id_reserva = p_id_reserva
  for update;

  -- Reserva confirmada, já cancelada ou com cobrança criada não é desfeita aqui
  if v_status_reserva <> 'PENDENTE'
    or v_id_pagamento is null
    or v_status_pagamento <> 'PENDENTE'
    or v_id_externo is not null then
    return false;
  end if;

  update public.reserva set status = 'CANCELADA' where id_reserva = p_id_reserva;
  update public.pagamento set status = 'RECUSADO' where id_pagamento = v_id_pagamento;

  update public.carona c
  set vagas_disponiveis = c.vagas_disponiveis + 1,
      status = case when c.status = 'LOTADA' then 'ABERTA' else c.status end
  where c.id_carona = v_id_carona;

  return true;
end;
$$;

revoke execute on function public.desfazer_reserva_sem_cobranca(uuid)
  from public, anon, authenticated;
grant execute on function public.desfazer_reserva_sem_cobranca(uuid) to service_role;
