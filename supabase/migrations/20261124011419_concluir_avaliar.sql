-- T30 — Conclusão da carona e avaliações (RN07, RN19).
-- O motorista conclui a carona da partida até 1 dia depois; sem isso, o job concluir-caronas
-- conclui sozinho. Depois de concluída, motorista e passageiro de cada reserva CONFIRMADA se
-- avaliam (nota 1 a 5) até 7 dias depois da partida. Perfil público: nome, média e total.
-- Decisões do Gustavo, 24/11/2026.

-- ============================================================
-- Prazos (um lugar só cada)
-- ============================================================

-- RN07: até quanto tempo depois da partida o motorista conclui; depois disso, o job conclui
create function public.prazo_conclusao_carona()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '1 day'
$$;

-- RN19: até quanto tempo depois da partida os participantes se avaliam
create function public.prazo_avaliacao()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '7 days'
$$;

revoke execute on function public.prazo_conclusao_carona(), public.prazo_avaliacao()
  from public, anon, authenticated;
grant execute on function public.prazo_conclusao_carona(), public.prazo_avaliacao()
  to service_role;

-- "1 dia", "7 dias": o mesmo prazo nas frases de erro
create function public.texto_prazo_em_dias(p_prazo interval)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(day from p_prazo)::int
    || case when extract(day from p_prazo)::int = 1 then ' dia' else ' dias' end
$$;

revoke execute on function public.texto_prazo_em_dias(interval) from public, anon, authenticated;

-- ============================================================
-- concluir_carona (motorista)
-- ============================================================

-- RN07: o motorista do auth.uid() conclui a própria carona ABERTA ou LOTADA entre a partida e o
-- prazo de conclusão. Só muda o status da carona (reservas e pagamentos ficam como estão). Devolve
-- quantas reservas CONFIRMADA a carona tinha (quem poderá avaliar).
create function public.concluir_carona(p_id_carona uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_carona public.carona%rowtype;
  v_prazo interval := public.prazo_conclusao_carona();
  v_confirmadas integer;
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

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

  if v_carona.status not in ('ABERTA', 'LOTADA') then
    raise exception 'CARONA_JA_ENCERRADA'
      using errcode = 'PT409', hint = 'Esta carona já foi concluída ou cancelada.';
  end if;

  if now() < v_carona.data_hora_partida then
    raise exception 'CARONA_NAO_PARTIU'
      using errcode = 'PT409', hint = 'A carona só pode ser concluída depois do horário de partida.';
  end if;

  if now() > v_carona.data_hora_partida + v_prazo then
    raise exception 'CONCLUSAO_ENCERRADA'
      using errcode = 'PT409',
            hint = format(
              'O prazo para concluir esta carona era de %s depois da partida. Ela é concluída automaticamente.',
              public.texto_prazo_em_dias(v_prazo)
            );
  end if;

  update public.carona set status = 'CONCLUIDA' where id_carona = p_id_carona;

  select count(*)::int
  into v_confirmadas
  from public.reserva r
  where r.id_carona = p_id_carona
    and r.status = 'CONFIRMADA';

  return v_confirmadas;
end;
$$;

revoke execute on function public.concluir_carona(uuid) from public, anon;
grant execute on function public.concluir_carona(uuid) to authenticated;

-- ============================================================
-- concluir_caronas_vencidas (pg_cron e service_role)
-- ============================================================

-- RN07: carona ABERTA ou LOTADA que passou do prazo de conclusão vira CONCLUIDA. Um UPDATE só: cada
-- linha é travada e a condição é conferida de novo depois do lock (se o motorista concluiu ou
-- cancelou no meio-tempo, a linha sai). Devolve quantas concluiu.
create function public.concluir_caronas_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_concluidas integer;
begin
  with concluidas as (
    update public.carona c
    set status = 'CONCLUIDA'
    where c.status in ('ABERTA', 'LOTADA')
      and c.data_hora_partida + public.prazo_conclusao_carona() < now()
    returning 1
  )
  select count(*)::int into v_concluidas from concluidas;

  return v_concluidas;
end;
$$;

revoke execute on function public.concluir_caronas_vencidas() from public, anon, authenticated;
grant execute on function public.concluir_caronas_vencidas() to service_role;

-- Mesmo padrão do expirar-reservas: cron.schedule com nome já existente substitui o job (upsert);
-- roda como postgres, dono da função
select cron.schedule(
  'concluir-caronas',
  '0 * * * *',
  $$select public.concluir_caronas_vencidas()$$
);

-- ============================================================
-- AVALIACAO
-- ============================================================

create table public.avaliacao (
  id_avaliacao uuid primary key default gen_random_uuid(),
  -- Cascata: a exclusão da conta leva as reservas (e com elas as avaliações) junto
  id_reserva uuid not null references public.reserva (id_reserva) on delete cascade,
  id_avaliador uuid not null references public.usuario (id_usuario) on delete cascade,
  id_avaliado uuid not null references public.usuario (id_usuario) on delete cascade,
  nota smallint not null,
  comentario varchar(500),
  criado_em timestamptz not null default now(),
  constraint avaliacao_nota_faixa check (nota between 1 and 5),
  constraint avaliacao_avaliador_diferente_avaliado check (id_avaliador <> id_avaliado),
  -- RN19: uma avaliação por avaliador por reserva
  constraint avaliacao_id_reserva_id_avaliador_key unique (id_reserva, id_avaliador)
);

-- RLS (id_avaliador) e média do perfil público (id_avaliado)
create index avaliacao_id_avaliador_idx on public.avaliacao (id_avaliador);
create index avaliacao_id_avaliado_idx on public.avaliacao (id_avaliado);

alter table public.avaliacao enable row level security;

-- Cada um lê as avaliações que fez; o que recebeu aparece só agregado no perfil público
create policy "avaliador lê as próprias avaliações"
  on public.avaliacao for select
  to authenticated
  using (id_avaliador = (select auth.uid()));

-- Mesmo padrão das outras tabelas: revoga tudo e concede o mínimo. Escrita só pela
-- avaliar_participante.
revoke all on public.avaliacao from public, anon, authenticated;
grant select on public.avaliacao to authenticated;
grant all on public.avaliacao to service_role;

-- ============================================================
-- resumo_avaliacoes (interna)
-- ============================================================

-- Média (1 casa) e total das avaliações recebidas: a mesma conta no perfil público e no detalhe
create function public.resumo_avaliacoes(p_id_usuario uuid)
returns table (media numeric, total int)
language sql
stable
set search_path = ''
as $$
  select round(avg(a.nota), 1), count(*)::int
  from public.avaliacao a
  where a.id_avaliado = p_id_usuario
$$;

revoke execute on function public.resumo_avaliacoes(uuid) from public, anon, authenticated;

-- ============================================================
-- avaliar_participante
-- ============================================================

-- RN19: o participante do auth.uid() avalia o outro lado da reserva. O avaliado é deduzido: o
-- passageiro avalia o motorista e o motorista avalia o passageiro. Só com a reserva CONFIRMADA e a
-- carona CONCLUIDA, até o prazo de avaliação depois da partida, uma vez por reserva.
create function public.avaliar_participante(
  p_id_reserva uuid,
  p_nota int,
  p_comentario text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_usuario uuid := auth.uid();
  v_comentario text := nullif(trim(p_comentario), '');
  v_id_carona uuid;
  v_carona public.carona%rowtype;
  v_reserva public.reserva%rowtype;
  v_id_avaliado uuid;
  v_prazo interval := public.prazo_avaliacao();
  v_id_avaliacao uuid;
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'NOTA_INVALIDA'
      using errcode = 'PT422', hint = 'Escolha uma nota de 1 a 5.';
  end if;

  if length(v_comentario) > 500 then
    raise exception 'DADOS_INVALIDOS'
      using errcode = 'PT400', hint = 'O comentário pode ter até 500 caracteres.';
  end if;

  select r.id_carona into v_id_carona from public.reserva r where r.id_reserva = p_id_reserva;

  -- Locks na ordem das outras funções: carona, depois reserva (FOR SHARE: só leitura estável)
  select c.* into v_carona from public.carona c where c.id_carona = v_id_carona for share;
  select r.* into v_reserva from public.reserva r where r.id_reserva = p_id_reserva for share;

  if v_reserva.id_reserva is not null and v_reserva.id_passageiro = v_id_usuario then
    v_id_avaliado := v_carona.id_motorista;
  elsif v_reserva.id_reserva is not null and v_carona.id_motorista = v_id_usuario then
    v_id_avaliado := v_reserva.id_passageiro;
  end if;

  -- Inexistente e de quem não participa têm a mesma resposta
  if v_id_avaliado is null then
    raise exception 'RESERVA_NAO_ENCONTRADA'
      using errcode = 'PT404', hint = 'Reserva não encontrada.';
  end if;

  if v_reserva.status <> 'CONFIRMADA' or v_carona.status <> 'CONCLUIDA' then
    raise exception 'AVALIACAO_INDISPONIVEL'
      using errcode = 'PT409',
            hint = 'A avaliação fica disponível depois que a carona é concluída, para reservas pagas.';
  end if;

  if now() > v_carona.data_hora_partida + v_prazo then
    raise exception 'PRAZO_AVALIACAO_ENCERRADO'
      using errcode = 'PT409',
            hint = format(
              'O prazo para avaliar esta carona era de %s depois da partida.',
              public.texto_prazo_em_dias(v_prazo)
            );
  end if;

  begin
    insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota, comentario)
    values (p_id_reserva, v_id_usuario, v_id_avaliado, p_nota, v_comentario)
    returning id_avaliacao into v_id_avaliacao;
  exception
    when unique_violation then
      raise exception 'AVALIACAO_DUPLICADA'
        using errcode = 'PT409', hint = 'Você já avaliou esta carona.';
  end;

  return v_id_avaliacao;
end;
$$;

revoke execute on function public.avaliar_participante(uuid, int, text) from public, anon;
grant execute on function public.avaliar_participante(uuid, int, text) to authenticated;

-- ============================================================
-- avaliacoes_pendentes (app)
-- ============================================================

-- Para o auth.uid(): as reservas que ainda pode avaliar (CONFIRMADA, carona CONCLUIDA, dentro do
-- prazo, sem avaliação dele). papel = o papel de quem avalia; só o primeiro nome do avaliado.
create function public.avaliacoes_pendentes()
returns table (
  id_reserva uuid,
  papel text,
  nome_avaliado text,
  origem text,
  destino text,
  data_hora_partida timestamptz,
  avaliar_ate timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id_usuario uuid := auth.uid();
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  return query
  select
    r.id_reserva,
    case when r.id_passageiro = v_id_usuario then 'PASSAGEIRO' else 'MOTORISTA' end,
    -- Como na busca: só o primeiro nome
    split_part(trim(avaliado.nome_completo), ' ', 1),
    c.origem::text,
    c.destino::text,
    c.data_hora_partida,
    c.data_hora_partida + public.prazo_avaliacao()
  from public.reserva r
  join public.carona c on c.id_carona = r.id_carona
  join public.usuario avaliado
    on avaliado.id_usuario =
      case when r.id_passageiro = v_id_usuario then c.id_motorista else r.id_passageiro end
  where (r.id_passageiro = v_id_usuario or c.id_motorista = v_id_usuario)
    and r.status = 'CONFIRMADA'
    and c.status = 'CONCLUIDA'
    and now() <= c.data_hora_partida + public.prazo_avaliacao()
    and not exists (
      select 1 from public.avaliacao a
      where a.id_reserva = r.id_reserva and a.id_avaliador = v_id_usuario
    )
  order by c.data_hora_partida desc, r.id_reserva;
end;
$$;

revoke execute on function public.avaliacoes_pendentes() from public, anon;
grant execute on function public.avaliacoes_pendentes() to authenticated;

-- ============================================================
-- perfil_publico
-- ============================================================

-- Perfil público de qualquer usuário para quem está logado: nome, média (1 casa) e total das
-- avaliações recebidas. Sem e-mail, telefone nem gênero. Função (e não view security definer, que
-- o linter do Supabase marca como risco): o filtro e as colunas ficam presos aqui.
create function public.perfil_publico(p_id_usuario uuid)
returns table (
  id_usuario uuid,
  nome text,
  media_avaliacoes numeric,
  total_avaliacoes int
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
  select u.id_usuario, u.nome_completo::text, resumo.media, resumo.total
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
-- detalhar_carona com a reputação do motorista
-- ============================================================

-- Nova versão (a de 20261017141431 não é editada): mesmas colunas, regras e erros, mais
-- media_motorista e total_avaliacoes_motorista. O tipo de retorno muda, então é drop + create.
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
    resumo.total
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
