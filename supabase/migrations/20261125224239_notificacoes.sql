-- T29 — Notificações dentro do app (US06). Decisão do Gustavo (25/11): só o aviso no app nesta
-- entrega; o push (Expo Notifications) fica para depois, porque no Android exige development build.
-- • Tabela notificacao (docs/DATABASE.md) + id_carona e id_reserva opcionais, para o app abrir a
--   tela certa. O app só LÊ as próprias (RLS); quem escreve são os gatilhos abaixo, e "lida" muda
--   pela RPC marcar_notificacoes_lidas.
-- • Gatilhos AFTER em reserva e avaliacao que só inserem avisos. Eles NUNCA propagam erro: um aviso
--   que falha não pode desfazer um pagamento, um cancelamento ou uma avaliação (o bloco com
--   exception vira um subtransação: se o insert falhar, só ele é desfeito).
-- • Nenhuma função existente muda (confirmar_pagamento, cancelar_reserva, cancelar_carona,
--   expirar_reservas, avaliar_participante...): os avisos saem das mudanças de status que elas já
--   fazem.

-- ============================================================
-- Tabela
-- ============================================================

create type public.tipo_notificacao as enum (
  'NOVA_RESERVA',
  'RESERVA_CONFIRMADA',
  'CARONA_CANCELADA',
  'RESERVA_CANCELADA',
  'AVALIACAO'
);

create table public.notificacao (
  id_notificacao uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references public.usuario (id_usuario) on delete cascade,
  tipo public.tipo_notificacao not null,
  mensagem varchar(300) not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now(),
  -- Para o app abrir a tela certa; o aviso continua se a carona ou a reserva sumir
  id_carona uuid references public.carona (id_carona) on delete set null,
  id_reserva uuid references public.reserva (id_reserva) on delete set null
);

-- Lista do usuário, mais recentes primeiro
create index notificacao_id_usuario_criado_em_idx
  on public.notificacao (id_usuario, criado_em desc);
create index notificacao_id_carona_idx on public.notificacao (id_carona);
create index notificacao_id_reserva_idx on public.notificacao (id_reserva);

alter table public.notificacao enable row level security;

create policy "usuário lê as próprias notificações"
  on public.notificacao for select
  to authenticated
  using (id_usuario = (select auth.uid()));

-- Só leitura pelo app; escrita pelos gatilhos e pela RPC (SECURITY DEFINER)
revoke all on public.notificacao from public, anon, authenticated;
grant select on public.notificacao to authenticated;
grant all on public.notificacao to service_role;

-- ============================================================
-- Textos (internas)
-- ============================================================

-- "ULBRA Torres - RS" → "ULBRA Torres": a mesma regra do nomeCurtoLocal do app (só as 27 UFs)
create function public.nome_curto_local(p_local text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(regexp_replace(
        regexp_replace(btrim(p_local), '\s+', ' ', 'g'),
        '\s*(?:[-–—]|,)\s*(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\s*$',
        ''
      )),
      ''
    ),
    btrim(p_local)
  )
$$;

-- "a carona para ULBRA Torres em 26/11 às 19:00" (data e hora de Brasília)
create function public.descrever_carona_aviso(p_destino text, p_partida timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select 'carona para ' || public.nome_curto_local(p_destino) || ' em '
    || to_char(p_partida at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
$$;

revoke execute on function public.nome_curto_local(text) from public, anon, authenticated;
revoke execute on function public.descrever_carona_aviso(text, timestamptz)
  from public, anon, authenticated;

-- ============================================================
-- Gatilho em reserva: confirmação e cancelamentos
-- ============================================================

-- • → CONFIRMADA (confirmar_pagamento): RESERVA_CONFIRMADA ao passageiro e NOVA_RESERVA ao motorista.
-- • PENDENTE/CONFIRMADA → CANCELADA:
--   - carona já CANCELADA: foi a cancelar_carona (ela cancela a carona ANTES das reservas), então
--     CARONA_CANCELADA ao passageiro desta reserva — um aviso por reserva ativa, nada ao motorista;
--   - carona ainda ativa: foi o passageiro (cancelar_reserva) ou a cobrança desfeita; o motorista
--     só é avisado (RESERVA_CANCELADA) se a reserva estava CONFIRMADA (a vaga paga voltou).
-- • PENDENTE → EXPIRADA (expirar_reservas): nenhum aviso.
create function public.notificar_mudanca_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carona record;
  v_passageiro text;
  v_trecho text;
begin
  begin
    select c.id_carona, c.id_motorista, c.status, c.destino, c.data_hora_partida
    into v_carona
    from public.carona c
    where c.id_carona = new.id_carona;

    if not found then
      return null;
    end if;

    v_trecho := public.descrever_carona_aviso(v_carona.destino, v_carona.data_hora_partida);

    select split_part(btrim(u.nome_completo), ' ', 1)
    into v_passageiro
    from public.usuario u
    where u.id_usuario = new.id_passageiro;
    v_passageiro := coalesce(nullif(v_passageiro, ''), 'Um passageiro');

    if new.status = 'CONFIRMADA' then
      insert into public.notificacao (id_usuario, tipo, mensagem, id_carona, id_reserva)
      values
        (new.id_passageiro, 'RESERVA_CONFIRMADA',
         left('Pagamento confirmado: sua vaga na ' || v_trecho || ' está garantida.', 300),
         new.id_carona, new.id_reserva),
        (v_carona.id_motorista, 'NOVA_RESERVA',
         left(v_passageiro || ' reservou uma vaga na sua ' || v_trecho || '.', 300),
         new.id_carona, new.id_reserva);

    elsif new.status = 'CANCELADA' and old.status in ('PENDENTE', 'CONFIRMADA') then
      if v_carona.status = 'CANCELADA' then
        insert into public.notificacao (id_usuario, tipo, mensagem, id_carona, id_reserva)
        values (
          new.id_passageiro, 'CARONA_CANCELADA',
          left('O motorista cancelou a ' || v_trecho || '.', 300),
          new.id_carona, new.id_reserva
        );
      elsif old.status = 'CONFIRMADA' then
        insert into public.notificacao (id_usuario, tipo, mensagem, id_carona, id_reserva)
        values (
          v_carona.id_motorista, 'RESERVA_CANCELADA',
          left(v_passageiro || ' cancelou a reserva na sua ' || v_trecho
            || '. A vaga voltou a ficar livre.', 300),
          new.id_carona, new.id_reserva
        );
      end if;
    end if;
  exception when others then
    -- O aviso é secundário: o que disparou o gatilho (pagamento, cancelamento) segue sem ele
    raise warning 'notificacao (reserva %) não gravada: %', new.id_reserva, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.notificar_mudanca_reserva() from public, anon, authenticated;

create trigger notificar_mudanca_reserva
  after update of status on public.reserva
  for each row
  when (old.status is distinct from new.status)
  execute function public.notificar_mudanca_reserva();

-- ============================================================
-- Gatilho em avaliacao: AVALIACAO ao avaliado
-- ============================================================

create function public.notificar_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carona record;
begin
  begin
    select c.id_carona, c.destino, c.data_hora_partida
    into v_carona
    from public.reserva r
    join public.carona c on c.id_carona = r.id_carona
    where r.id_reserva = new.id_reserva;

    insert into public.notificacao (id_usuario, tipo, mensagem, id_carona, id_reserva)
    values (
      new.id_avaliado, 'AVALIACAO',
      left(
        'Você recebeu uma avaliação de ' || new.nota
          || case when new.nota = 1 then ' estrela' else ' estrelas' end
          || case
               when v_carona.id_carona is null then '.'
               else ' pela ' || public.descrever_carona_aviso(v_carona.destino,
                 v_carona.data_hora_partida) || '.'
             end,
        300
      ),
      v_carona.id_carona, new.id_reserva
    );
  exception when others then
    raise warning 'notificacao (avaliação %) não gravada: %', new.id_avaliacao, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.notificar_avaliacao() from public, anon, authenticated;

create trigger notificar_avaliacao
  after insert on public.avaliacao
  for each row
  execute function public.notificar_avaliacao();

-- ============================================================
-- RPCs
-- ============================================================

-- Marca como lidas as notificações do usuário logado: as de p_ids, ou todas (null). Ids de outro
-- usuário são ignorados. Devolve quantas passaram de não lida para lida.
create function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_total integer;
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  update public.notificacao n
  set lida = true
  where n.id_usuario = v_id_usuario
    and not n.lida
    and (p_ids is null or n.id_notificacao = any (p_ids));
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke execute on function public.marcar_notificacoes_lidas(uuid[]) from public, anon;
grant execute on function public.marcar_notificacoes_lidas(uuid[]) to authenticated;

create function public.contar_notificacoes_nao_lidas()
returns integer
language plpgsql
stable
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

  return (
    select count(*)::integer
    from public.notificacao n
    where n.id_usuario = v_id_usuario and not n.lida
  );
end;
$$;

revoke execute on function public.contar_notificacoes_nao_lidas() from public, anon;
grant execute on function public.contar_notificacoes_nao_lidas() to authenticated;
