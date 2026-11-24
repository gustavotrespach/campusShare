-- T42 — "Minhas reservas" com a nota do motorista. Nova versão da minhas_reservas (a de
-- 20261017210323 não é editada): mesmas colunas, ordem, filtro por auth.uid() e erros, mais
-- media_motorista (1 casa, nula sem avaliações) e total_avaliacoes_motorista no fim, calculadas pela
-- resumo_avaliacoes (T30), a mesma conta do perfil_publico e do detalhar_carona. Uma consulta para a
-- lista toda: o app não chama a detalhar_carona por item. O tipo de retorno muda: drop + create.

drop function public.minhas_reservas();

create function public.minhas_reservas()
returns table (
  id_reserva uuid,
  status_reserva public.status_reserva,
  reservado_em timestamptz,
  status_pagamento public.status_pagamento,
  valor numeric,
  id_carona uuid,
  origem text,
  destino text,
  data_hora_partida timestamptz,
  status_carona public.status_carona,
  nome_motorista text,
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
begin
  if v_id_usuario is null then
    raise exception 'NAO_AUTENTICADO'
      using errcode = 'PT401', hint = 'Sua sessão expirou. Entre novamente.';
  end if;

  return query
  select
    r.id_reserva,
    r.status,
    r.criado_em,
    p.status,
    -- reservar_vaga cria reserva e pagamento juntos; o valor da reserva é a garantia se faltar
    coalesce(p.valor, r.valor_individual),
    c.id_carona,
    c.origem::text,
    c.destino::text,
    c.data_hora_partida,
    c.status,
    -- Como na busca: só o primeiro nome do motorista (sem e-mail, telefone, gênero nem id)
    split_part(trim(u.nome_completo), ' ', 1),
    -- Reputação do motorista (T42): a mesma conta do perfil público
    resumo.media,
    resumo.total
  from public.reserva r
  join public.carona c on c.id_carona = r.id_carona
  join public.usuario u on u.id_usuario = c.id_motorista
  left join public.pagamento p on p.id_reserva = r.id_reserva
  cross join lateral public.resumo_avaliacoes(c.id_motorista) resumo
  where r.id_passageiro = v_id_usuario
  order by r.criado_em desc, r.id_reserva;
end;
$$;

revoke execute on function public.minhas_reservas() from public, anon;
grant execute on function public.minhas_reservas() to authenticated;
