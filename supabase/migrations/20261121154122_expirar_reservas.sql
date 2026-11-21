-- T24 — Expiração de reservas pendentes (RN16, RN17, ADR-008).
-- Reserva PENDENTE sem pagamento confirmado em 15 minutos (desde reserva.criado_em) vira EXPIRADA:
-- o pagamento PENDENTE vira RECUSADO e a vaga volta para a carona. Roda a cada minuto pelo pg_cron.
-- Um Pix pago depois disso cai na confirmar_pagamento como REEMBOLSO_PENDENTE, sem mexer na vaga.

-- ============================================================
-- pg_cron (Supabase Cron)
-- ============================================================

-- Jeito indicado pela documentação do Supabase (guides/cron/install): extensão em pg_catalog e
-- acesso do postgres ao schema cron
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ============================================================
-- prazo_reserva_pendente
-- ============================================================

-- RN16: prazo para pagar a reserva PENDENTE (decisão do Gustavo, 21/11/2026). Único lugar do prazo.
create function public.prazo_reserva_pendente()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '15 minutes'
$$;

revoke execute on function public.prazo_reserva_pendente() from public, anon, authenticated;
grant execute on function public.prazo_reserva_pendente() to service_role;

-- ============================================================
-- expirar_reservas (pg_cron e service_role)
-- ============================================================

-- Expira as reservas PENDENTE vencidas e devolve quantas expirou. Cada reserva é tratada com a
-- carona travada (RN17), na mesma ordem de locks da reservar_vaga, da desfazer_reserva_sem_cobranca
-- e da confirmar_pagamento (carona → reserva → pagamento): o webhook e o job não se bloqueiam em
-- ordem cruzada. Depois dos locks a condição é conferida de novo: se o webhook confirmou no
-- meio-tempo, a reserva é pulada.
create function public.expirar_reservas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite timestamptz := now() - public.prazo_reserva_pendente();
  v_candidata record;
  v_status_reserva public.status_reserva;
  v_criado_em timestamptz;
  v_expiradas integer := 0;
begin
  -- Candidatas lidas sem lock: a decisão só vale depois de travar carona e reserva
  for v_candidata in
    select r.id_reserva, r.id_carona
    from public.reserva r
    where r.status = 'PENDENTE'
      and r.criado_em <= v_limite
    order by r.criado_em
  loop
    -- 1º a carona
    perform 1 from public.carona c where c.id_carona = v_candidata.id_carona for update;

    -- 2º a reserva, conferida de novo depois do lock
    select r.status, r.criado_em
    into v_status_reserva, v_criado_em
    from public.reserva r
    where r.id_reserva = v_candidata.id_reserva
    for update;

    if not found or v_status_reserva <> 'PENDENTE' or v_criado_em > v_limite then
      continue;
    end if;

    -- 3º o pagamento
    perform 1 from public.pagamento p where p.id_reserva = v_candidata.id_reserva for update;

    update public.reserva
    set status = 'EXPIRADA'
    where id_reserva = v_candidata.id_reserva;

    -- Só o pagamento PENDENTE é recusado; outro status com a reserva PENDENTE seria inconsistente e
    -- fica como está
    update public.pagamento
    set status = 'RECUSADO'
    where id_reserva = v_candidata.id_reserva
      and status = 'PENDENTE';

    -- Vaga de volta, como na desfazer_reserva_sem_cobranca: LOTADA reabre; CANCELADA e CONCLUIDA
    -- mantêm o status
    update public.carona c
    set vagas_disponiveis = c.vagas_disponiveis + 1,
        status = case when c.status = 'LOTADA' then 'ABERTA' else c.status end
    where c.id_carona = v_candidata.id_carona;

    v_expiradas := v_expiradas + 1;
  end loop;

  return v_expiradas;
end;
$$;

revoke execute on function public.expirar_reservas() from public, anon, authenticated;
grant execute on function public.expirar_reservas() to service_role;

-- A varredura do job só olha as PENDENTE, pela idade
create index reserva_pendente_criado_em_idx
  on public.reserva (criado_em)
  where status = 'PENDENTE';

-- ============================================================
-- Job expirar-reservas (a cada minuto)
-- ============================================================

-- cron.schedule com um nome que já existe substitui o job (upsert, documentação do Supabase Cron):
-- rodar o agendamento de novo não duplica o job. O job roda como quem agendou (postgres), que é o
-- dono da função e por isso pode executá-la mesmo sem o EXECUTE de public.
select cron.schedule(
  'expirar-reservas',
  '* * * * *',
  $$select public.expirar_reservas()$$
);
