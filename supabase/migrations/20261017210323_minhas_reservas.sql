-- T25 — "Minhas reservas": reservas do usuário logado com o pagamento e a carona.
-- O passageiro não lê a tabela carona (só o motorista lê as próprias; ver MEMORY "RLS entre
-- reserva e carona"), então a lista sai por esta função SECURITY DEFINER, que filtra por
-- auth.uid() e devolve só colunas públicas da carona e o primeiro nome do motorista.

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
  nome_motorista text
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
    -- Como na busca: só o primeiro nome do motorista
    split_part(trim(u.nome_completo), ' ', 1)
  from public.reserva r
  join public.carona c on c.id_carona = r.id_carona
  join public.usuario u on u.id_usuario = c.id_motorista
  left join public.pagamento p on p.id_reserva = r.id_reserva
  where r.id_passageiro = v_id_usuario
  order by r.criado_em desc, r.id_reserva;
end;
$$;

revoke execute on function public.minhas_reservas() from public, anon;
grant execute on function public.minhas_reservas() to authenticated;
