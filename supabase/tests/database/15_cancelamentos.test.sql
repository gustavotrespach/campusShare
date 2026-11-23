-- T28 — cancelar_reserva (passageiro, RN20) e cancelar_carona (motorista, RN07): status de reserva e
-- pagamento, vagas, prazo de 2 h para reserva paga, reserva alheia e encerrada, Pix pago depois do
-- cancelamento, carona cancelada fora da busca e da reserva, e acesso.
-- Horários relativos a now() (fixo dentro da transação do teste).
begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0…0a · N = outro motorista e0…0e · P = b0…0b · Q = f0…0f · R = c0…0c · S = d0…0d
-- c1: 1 vaga, amanhã · c2: 3 vagas, +3 h · c3: 3 vagas, +1 h · c4: amanhã (depois "já partiu")
-- c5: 4 vagas, amanhã (o motorista cancela) · c6: amanhã · c7: amanhã (depois CONCLUIDA)
-- ------------------------------------------------------------

-- As reservas do seed.sql não entram aqui; o rollback as devolve
delete from public.reserva;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'm@teste.edu.br', '{"nome_completo": "M"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br', '{"nome_completo": "N"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br', '{"nome_completo": "P"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Q"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "R"}'),
  ('d0000000-0000-0000-0000-00000000000d', 's@teste.edu.br', '{"nome_completo": "S"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
select ('50000000-0000-0000-0000-00000000000' || n)::uuid, 'a0000000-0000-0000-0000-00000000000a',
       'a1000000-0000-0000-0000-000000000001', 'Centro', -29.3353, -49.7268, 'ULBRA', -29.329,
       -49.7365, now() + partida, vagas, vagas, 24, 10
from (values (1, 1, interval '1 day'), (2, 3, interval '3 hours'), (3, 3, interval '1 hour'),
             (4, 3, interval '1 day'), (5, 4, interval '1 day'), (6, 3, interval '1 day'),
             (7, 3, interval '1 day')) as c (n, vagas, partida);

-- Funções de apoio do teste (security definer: também servem enquanto o papel é authenticated)
create function public.teste_reserva(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql security definer set search_path = ''
as $$
  select r.id_reserva from public.reserva r
  where r.id_carona = p_id_carona and r.id_passageiro = p_id_passageiro
$$;
create function public.teste_pagamento(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql security definer set search_path = ''
as $$
  select p.id_pagamento from public.pagamento p
  where p.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro)
$$;
create function public.teste_status(p_id_carona uuid, p_id_passageiro uuid) returns text
language sql security definer set search_path = ''
as $$
  select r.status::text || '/' || p.status::text
  from public.reserva r join public.pagamento p using (id_reserva)
  where r.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro)
$$;
create function public.teste_carona(p_id_carona uuid) returns text
language sql security definer set search_path = ''
as $$
  select c.status::text || '/' || c.vagas_disponiveis from public.carona c
  where c.id_carona = p_id_carona
$$;
-- Paga a reserva como o webhook faria (T22 + T23)
create function public.teste_pagar(p_id_carona uuid, p_id_passageiro uuid, p_order text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id_pagamento uuid := public.teste_pagamento(p_id_carona, p_id_passageiro);
begin
  if (select p.id_externo from public.pagamento p where p.id_pagamento = v_id_pagamento) is null then
    perform public.registrar_cobranca(v_id_pagamento, p_order);
  end if;
  return public.confirmar_pagamento(
    p_order, v_id_pagamento,
    (select p.valor from public.pagamento p where p.id_pagamento = v_id_pagamento)
  );
end;
$$;
grant execute on function public.teste_reserva(uuid, uuid), public.teste_pagamento(uuid, uuid),
  public.teste_status(uuid, uuid), public.teste_carona(uuid) to authenticated;

-- Reservas (reservar_vaga como a Edge Function, T21)
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select public.registrar_cobranca(
  public.teste_pagamento('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000T281'
);
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b');
select public.teste_pagar('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T282');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b');
select public.teste_pagar('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T283');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-00000000000d');
-- c5: P PENDENTE, Q CONFIRMADA, R desiste antes (CANCELADA), S expira (EXPIRADA)
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000b');
-- A order do Pix de P na c5 já existe quando a carona é cancelada (o Pix chega depois)
select public.registrar_cobranca(
  public.teste_pagamento('50000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000T286'
);
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-00000000000f');
select public.teste_pagar('50000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-00000000000f', 'ORDTST0000000000000000000000T285');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c');
select * from public.reservar_vaga('50000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-00000000000d');

-- R em c2 e S em c5 vencem (T24); depois c4 "parte" e c7 é concluída
update public.reserva set criado_em = now() - interval '16 minutes'
where id_reserva in (
  public.teste_reserva('50000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c'),
  public.teste_reserva('50000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-00000000000d')
);
select public.expirar_reservas();
update public.carona set data_hora_partida = now() - interval '1 minute'
where id_carona = '50000000-0000-0000-0000-000000000004';
update public.carona set status = 'CONCLUIDA'
where id_carona = '50000000-0000-0000-0000-000000000007';

select is(
  public.teste_carona('50000000-0000-0000-0000-000000000001'),
  'LOTADA/0',
  'antes: c1 LOTADA'
);

-- ============================================================
-- cancelar_reserva
-- ============================================================

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

-- PENDENTE: a vaga volta e a carona reabre
select is(
  public.cancelar_reserva(public.teste_reserva('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')),
  'CANCELADA',
  'PENDENTE: devolve o status final CANCELADA'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'CANCELADA/RECUSADO',
  'PENDENTE: reserva CANCELADA e pagamento RECUSADO'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000001'),
  'ABERTA/1',
  'PENDENTE: a vaga volta e a carona LOTADA reabre'
);

-- Segunda chamada seguida: recusada, sem devolver a vaga de novo
select throws_ok(
  format('select public.cancelar_reserva(%L)', public.teste_reserva('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')),
  'PT409', 'RESERVA_JA_ENCERRADA', 'cancelar duas vezes é recusado'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000001'),
  'ABERTA/1',
  'a segunda chamada não devolve a vaga outra vez'
);

-- CONFIRMADA com 3 h para a partida: reembolso
select is(
  public.cancelar_reserva(public.teste_reserva('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b')),
  'CANCELADA',
  'CONFIRMADA com 3 h: cancela'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b'),
  'CANCELADA/REEMBOLSO_PENDENTE',
  'CONFIRMADA com 3 h: pagamento APROVADO vira REEMBOLSO_PENDENTE'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000002'),
  'ABERTA/3',
  'CONFIRMADA com 3 h: a vaga volta (a de R já tinha voltado na expiração)'
);

-- CONFIRMADA com 1 h para a partida: fora do prazo da RN20
select throws_ok(
  format('select public.cancelar_reserva(%L)', public.teste_reserva('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b')),
  'PT409', 'PRAZO_CANCELAMENTO_ENCERRADO', 'CONFIRMADA com 1 h é recusada (RN20)'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
  'CONFIRMADA/APROVADO',
  'CONFIRMADA com 1 h: reserva e pagamento não mudam'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000003'),
  'ABERTA/1',
  'CONFIRMADA com 1 h: as vagas não mudam'
);

-- A frase do limite vai no hint, para o app mostrar (capturada como postgres, com o mesmo JWT de P)
reset role;
create temporary table erro_prazo (dica text) on commit drop;
do $$
declare
  v_dica text;
begin
  perform public.cancelar_reserva(public.teste_reserva('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'));
exception when others then
  get stacked diagnostics v_dica = pg_exception_hint;
  insert into erro_prazo (dica) values (v_dica);
end;
$$;
select is(
  (select dica from erro_prazo),
  'Reservas pagas só podem ser canceladas até 2 horas antes da partida.',
  'o hint explica o limite de 2 horas'
);
set local role authenticated;

-- Reserva de outro usuário e reserva inexistente: mesma resposta
select throws_ok(
  format('select public.cancelar_reserva(%L)', public.teste_reserva('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f')),
  'PT404', 'RESERVA_NAO_ENCONTRADA', 'reserva de outro passageiro: não encontrada'
);
select throws_ok(
  $$select public.cancelar_reserva('99999999-0000-0000-0000-000000000000')$$,
  'PT404', 'RESERVA_NAO_ENCONTRADA', 'reserva inexistente: não encontrada'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f'),
  'PENDENTE/PENDENTE',
  'a reserva alheia não mudou'
);

-- PENDENTE com 1 h para a partida: pode (o limite de 2 h é só para reserva paga)
select set_config('request.jwt.claims', '{"sub": "f0000000-0000-0000-0000-00000000000f", "role": "authenticated"}', true);
select is(
  public.cancelar_reserva(public.teste_reserva('50000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f')),
  'CANCELADA',
  'PENDENTE com 1 h: cancela'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000003'),
  'ABERTA/2',
  'PENDENTE com 1 h: a vaga volta'
);

-- EXPIRADA: já encerrada
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
select throws_ok(
  format('select public.cancelar_reserva(%L)', public.teste_reserva('50000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c')),
  'PT409', 'RESERVA_JA_ENCERRADA', 'reserva EXPIRADA não é cancelada'
);

-- R desiste da c5 antes do motorista cancelar (fica CANCELADA antiga para a cancelar_carona)
select is(
  public.cancelar_reserva(public.teste_reserva('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c')),
  'CANCELADA',
  'R cancela a própria reserva PENDENTE na c5'
);

-- Carona que já partiu
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-00000000000d", "role": "authenticated"}', true);
select throws_ok(
  format('select public.cancelar_reserva(%L)', public.teste_reserva('50000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-00000000000d')),
  'PT409', 'CANCELAMENTO_ENCERRADO', 'carona que já partiu: não cancela'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-00000000000d'),
  'PENDENTE/PENDENTE',
  'carona que já partiu: a reserva não muda'
);

reset role;

-- Pix pago depois do cancelamento (c1, a order já estava registrada): reembolso, vaga intacta
select is(
  public.teste_pagar('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T281'),
  'REEMBOLSO_PENDENTE',
  'Pix pago depois do cancelamento: confirmar_pagamento devolve REEMBOLSO_PENDENTE'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'CANCELADA/REEMBOLSO_PENDENTE',
  'a reserva continua CANCELADA e o pagamento fica para reembolso'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000001'),
  'ABERTA/1',
  'o Pix atrasado não mexe na vaga'
);
-- Notificação repetida da reserva paga e cancelada (c2): nada muda
select is(
  public.teste_pagar('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T282'),
  'REEMBOLSO_PENDENTE',
  'notificação repetida de reserva paga e cancelada continua REEMBOLSO_PENDENTE'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000002'),
  'ABERTA/3',
  'e não mexe na vaga'
);

-- ============================================================
-- cancelar_carona
-- ============================================================

select is(
  public.teste_carona('50000000-0000-0000-0000-000000000005'),
  'ABERTA/2',
  'antes: c5 com 2 de 4 vagas (P e Q ativas; R cancelada e S expirada devolveram as delas)'
);

set local role authenticated;

-- Outro motorista e um passageiro: não encontrada
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-00000000000e", "role": "authenticated"}', true);
select throws_ok(
  $$select public.cancelar_carona('50000000-0000-0000-0000-000000000005')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'outro motorista não cancela a carona'
);
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
select throws_ok(
  $$select public.cancelar_carona('50000000-0000-0000-0000-000000000005')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'passageiro não cancela a carona'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000005'),
  'ABERTA/2',
  'a carona não mudou'
);

-- O dono cancela
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
select is(
  public.cancelar_carona('50000000-0000-0000-0000-000000000005'),
  2,
  'o dono cancela e a função devolve 2 (as reservas PENDENTE e CONFIRMADA)'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000005'),
  'CANCELADA/2',
  'carona CANCELADA e vagas_disponiveis não muda'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000b'),
  'CANCELADA/RECUSADO',
  'reserva PENDENTE → CANCELADA e pagamento PENDENTE → RECUSADO'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-00000000000f'),
  'CANCELADA/REEMBOLSO_PENDENTE',
  'reserva CONFIRMADA → CANCELADA e pagamento APROVADO → REEMBOLSO_PENDENTE'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c'),
  'CANCELADA/RECUSADO',
  'reserva CANCELADA antiga não muda'
);
select is(
  public.teste_status('50000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-00000000000d'),
  'EXPIRADA/RECUSADO',
  'reserva EXPIRADA antiga não muda'
);

-- Encerradas: já CANCELADA, CONCLUIDA ou partida passada
select throws_ok(
  $$select public.cancelar_carona('50000000-0000-0000-0000-000000000005')$$,
  'PT409', 'CANCELAMENTO_ENCERRADO', 'carona já CANCELADA não é cancelada de novo'
);
select throws_ok(
  $$select public.cancelar_carona('50000000-0000-0000-0000-000000000007')$$,
  'PT409', 'CANCELAMENTO_ENCERRADO', 'carona CONCLUIDA não é cancelada'
);
select throws_ok(
  $$select public.cancelar_carona('50000000-0000-0000-0000-000000000004')$$,
  'PT409', 'CANCELAMENTO_ENCERRADO', 'carona que já partiu não é cancelada'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000004'),
  'ABERTA/2',
  'a carona que já partiu não mudou'
);

-- Carona sem reservas: cancela e devolve 0
select is(
  public.cancelar_carona('50000000-0000-0000-0000-000000000006'),
  0,
  'carona sem reservas: cancela e devolve 0'
);

-- A carona cancelada some da busca (R procura; a c2 aberta continua aparecendo)
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.buscar_caronas(-29.3353, -49.7268)
   where id_carona = '50000000-0000-0000-0000-000000000005'),
  0,
  'a carona cancelada some da buscar_caronas'
);
select is(
  (select count(*)::int from public.buscar_caronas(-29.3353, -49.7268)
   where id_carona = '50000000-0000-0000-0000-000000000002'),
  1,
  'controle: a carona aberta continua na busca'
);

reset role;

-- E não aceita reserva
select throws_ok(
  $$select * from public.reservar_vaga('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c')$$,
  'PT409', 'CARONA_INDISPONIVEL', 'a carona cancelada não aceita reservar_vaga'
);

-- Pix da c5 pago depois do cancelamento da carona: reembolso, vagas intactas
select is(
  public.teste_pagar('50000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T286'),
  'REEMBOLSO_PENDENTE',
  'Pix pago depois do cancelamento da carona vira REEMBOLSO_PENDENTE'
);
select is(
  public.teste_carona('50000000-0000-0000-0000-000000000005'),
  'CANCELADA/2',
  'e não mexe na carona'
);

-- ============================================================
-- Acesso
-- ============================================================

-- Sessão sem usuário (JWT sem sub)
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.cancelar_reserva('99999999-0000-0000-0000-000000000000')$$,
  'PT401', 'NAO_AUTENTICADO', 'cancelar_reserva sem auth.uid(): NAO_AUTENTICADO'
);
select throws_ok(
  $$select public.cancelar_carona('99999999-0000-0000-0000-000000000000')$$,
  'PT401', 'NAO_AUTENTICADO', 'cancelar_carona sem auth.uid(): NAO_AUTENTICADO'
);
select throws_ok(
  $$select public.prazo_cancelamento_confirmada()$$,
  '42501', null, 'authenticated não executa prazo_cancelamento_confirmada diretamente'
);
-- Sem INSERT/UPDATE direto: o cancelamento só passa pelas funções
select throws_ok(
  $$update public.reserva set status = 'CANCELADA'$$,
  '42501', null, 'authenticated não cancela reserva pela tabela'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select public.cancelar_reserva('99999999-0000-0000-0000-000000000000')$$,
  '42501', null, 'anon não executa cancelar_reserva'
);
select throws_ok(
  $$select public.cancelar_carona('99999999-0000-0000-0000-000000000000')$$,
  '42501', null, 'anon não executa cancelar_carona'
);
reset role;

select is(
  has_function_privilege('public', 'public.cancelar_reserva(uuid)', 'execute')
    or has_function_privilege('public', 'public.cancelar_carona(uuid)', 'execute'),
  false,
  'PUBLIC sem EXECUTE nas duas funções'
);
select is(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in ('public.cancelar_reserva(uuid)'::regprocedure, 'public.cancelar_carona(uuid)'::regprocedure)),
  true,
  'as duas são security definer com search_path vazio'
);

select * from finish();
rollback;
