-- T24 — expirar_reservas: reserva PENDENTE com mais de 15 min (RN16) vira EXPIRADA, o pagamento
-- PENDENTE vira RECUSADO e a vaga volta; reservas no prazo ou já encerradas não mudam; rodar de novo
-- não devolve a vaga duas vezes; Pix pago depois da expiração vira REEMBOLSO_PENDENTE sem mexer na
-- vaga; só o job (dono) e a service_role executam; o job existe no pg_cron.
-- O tempo é simulado recuando reserva.criado_em (now() é fixo dentro da transação do teste).
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- ------------------------------------------------------------
-- Agendamento e acesso
-- ------------------------------------------------------------

select is(
  (select schedule from cron.job where jobname = 'expirar-reservas'),
  '* * * * *',
  'o job expirar-reservas está no pg_cron, a cada minuto'
);
select is(
  (select command from cron.job where jobname = 'expirar-reservas'),
  'select public.expirar_reservas()',
  'o job chama a expirar_reservas'
);
select is(
  (select count(*)::int from cron.job where jobname = 'expirar-reservas'),
  1,
  'um único job com esse nome'
);
-- Agendar de novo com o mesmo nome substitui o job (upsert): o db reset ou um novo agendamento não
-- duplica
select cron.schedule('expirar-reservas', '* * * * *', $$select public.expirar_reservas()$$);
select is(
  (select count(*)::int from cron.job where jobname = 'expirar-reservas'),
  1,
  'agendar de novo não duplica o job'
);
select is(
  (select prosecdef and proconfig @> array['search_path=""']
     from pg_proc where oid = 'public.expirar_reservas()'::regprocedure),
  true,
  'expirar_reservas é security definer com search_path vazio'
);
select is(public.prazo_reserva_pendente(), interval '15 minutes', 'prazo da RN16: 15 minutos');

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · P = b0...0b · Q = f0...0f · R = c0...0c
-- c1: 1 vaga (LOTADA, volta ABERTA) · c2: no prazo · c3: CONFIRMADA e CANCELADA antigas
-- c4: carona CANCELADA com reserva vencida
-- ------------------------------------------------------------

-- As reservas do seed.sql entrariam na contagem conforme a hora do teste; o rollback as devolve
delete from public.reserva;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br', '{"nome_completo": "M"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br', '{"nome_completo": "P"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Q"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "R"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
select ('40000000-0000-0000-0000-00000000000' || n)::uuid, 'a0000000-0000-0000-0000-00000000000a',
       'a1000000-0000-0000-0000-000000000001', 'Centro', -29.3353, -49.7268, 'ULBRA', -29.329,
       -49.7365, now() + interval '1 day', vagas, vagas, 24, 10
from (values (1, 1), (2, 3), (3, 3), (4, 3)) as c (n, vagas);

create function public.teste_reserva(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql
as $$
  select r.id_reserva from public.reserva r
  where r.id_carona = p_id_carona and r.id_passageiro = p_id_passageiro
$$;

create function public.teste_pagamento(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql
as $$
  select p.id_pagamento from public.pagamento p
  where p.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro)
$$;

create function public.teste_status(p_id_carona uuid, p_id_passageiro uuid) returns text
language sql
as $$
  select r.status::text || '/' || p.status::text
  from public.reserva r join public.pagamento p using (id_reserva)
  where r.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro)
$$;

create function public.teste_carona(p_id_carona uuid) returns text
language sql
as $$
  select c.status::text || '/' || c.vagas_disponiveis from public.carona c
  where c.id_carona = p_id_carona
$$;

-- c1: P reserva a única vaga (LOTADA) e a order é registrada; vence (16 min)
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select public.registrar_cobranca(
  public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000T241'
);

-- c2: Q reserva há 14 min (ainda no prazo)
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f');

-- c3: P confirmada pelo webhook e Q desfeita sem cobrança, as duas antigas (30 min)
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b');
select public.registrar_cobranca(
  public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
  'ORDTST0000000000000000000000T243'
);
select public.confirmar_pagamento(
  'ORDTST0000000000000000000000T243',
  public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
  (select valor from public.pagamento
   where id_pagamento = public.teste_pagamento('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'))
);
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f');
select public.desfazer_reserva_sem_cobranca(
  public.teste_reserva('40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f')
);

-- c4: R reserva e depois o motorista cancela a carona; a reserva vence (20 min)
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000c');
update public.carona set status = 'CANCELADA' where id_carona = '40000000-0000-0000-0000-000000000004';

-- O relógio: recua o criado_em de cada reserva
update public.reserva set criado_em = now() - interval '16 minutes'
where id_reserva = public.teste_reserva('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
update public.reserva set criado_em = now() - interval '14 minutes'
where id_reserva = public.teste_reserva('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f');
update public.reserva set criado_em = now() - interval '30 minutes'
where id_carona = '40000000-0000-0000-0000-000000000003';
update public.reserva set criado_em = now() - interval '20 minutes'
where id_carona = '40000000-0000-0000-0000-000000000004';

-- Ponto de partida conferido
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000001'),
  'LOTADA/0',
  'antes: c1 LOTADA, sem vaga'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000003'),
  'ABERTA/2',
  'antes: c3 com 2 vagas (P confirmada; a vaga de Q já voltou)'
);

-- ------------------------------------------------------------
-- Primeira execução
-- ------------------------------------------------------------

select is(public.expirar_reservas(), 2, 'expira 2 reservas vencidas (c1 e c4) e devolve a quantidade');

-- c1: vencida há 16 min
select is(
  public.teste_status('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'EXPIRADA/RECUSADO',
  '16 min: reserva EXPIRADA e pagamento RECUSADO'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000001'),
  'ABERTA/1',
  '16 min: a vaga volta e a carona LOTADA reabre'
);

-- c2: 14 min, ainda no prazo
select is(
  public.teste_status('40000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f'),
  'PENDENTE/PENDENTE',
  '14 min: reserva e pagamento continuam PENDENTE'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000002'),
  'ABERTA/2',
  '14 min: a vaga continua ocupada'
);

-- c3: CONFIRMADA e CANCELADA antigas não mudam
select is(
  public.teste_status('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b'),
  'CONFIRMADA/APROVADO',
  'CONFIRMADA antiga não muda'
);
select is(
  public.teste_status('40000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000f'),
  'CANCELADA/RECUSADO',
  'CANCELADA antiga não muda'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000003'),
  'ABERTA/2',
  'as vagas da carona com reservas encerradas não mudam'
);

-- c4: carona CANCELADA
select is(
  public.teste_status('40000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-00000000000c'),
  'EXPIRADA/RECUSADO',
  'carona CANCELADA: a reserva vencida expira mesmo assim'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000004'),
  'CANCELADA/3',
  'carona CANCELADA: o status não muda (a vaga volta para a contagem)'
);

-- ------------------------------------------------------------
-- Segunda execução: EXPIRADA não volta a devolver vaga
-- ------------------------------------------------------------

select is(public.expirar_reservas(), 0, 'rodar de novo não expira nada');
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000001'),
  'ABERTA/1',
  'rodar de novo não devolve a vaga duas vezes'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000004'),
  'CANCELADA/3',
  'nem na carona cancelada'
);

-- ------------------------------------------------------------
-- Pix pago depois da expiração (webhook atrasado)
-- ------------------------------------------------------------

-- Outro passageiro ocupa a vaga devolvida antes do Pix atrasado chegar
select * from public.reservar_vaga('40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000001'),
  'LOTADA/0',
  'a vaga devolvida pode ser reservada por outro passageiro'
);

select is(
  public.confirmar_pagamento(
    'ORDTST0000000000000000000000T241',
    public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
    (select valor from public.pagamento
     where id_pagamento = public.teste_pagamento('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'))
  ),
  'REEMBOLSO_PENDENTE',
  'Pix pago depois da expiração: confirmar_pagamento devolve REEMBOLSO_PENDENTE'
);
select is(
  public.teste_status('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'EXPIRADA/REEMBOLSO_PENDENTE',
  'a reserva continua EXPIRADA e o pagamento fica para reembolso (T28)'
);
select is(
  public.teste_carona('40000000-0000-0000-0000-000000000001'),
  'LOTADA/0',
  'o Pix atrasado não mexe na vaga (continua com o outro passageiro)'
);
select is(
  public.teste_status('40000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c'),
  'PENDENTE/PENDENTE',
  'a reserva nova não é afetada'
);

-- ------------------------------------------------------------
-- Acesso: só o dono (job) e a service_role
-- ------------------------------------------------------------

set local role service_role;
select is(public.expirar_reservas(), 0, 'service_role executa expirar_reservas');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}',
  true
);
select throws_ok(
  $$select public.expirar_reservas()$$,
  '42501', null, 'authenticated não executa expirar_reservas'
);
select throws_ok(
  $$select public.prazo_reserva_pendente()$$,
  '42501', null, 'authenticated não executa prazo_reserva_pendente'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select public.expirar_reservas()$$,
  '42501', null, 'anon não executa expirar_reservas'
);
reset role;

select is(
  has_function_privilege('public', 'public.expirar_reservas()', 'execute'),
  false,
  'PUBLIC sem EXECUTE na expirar_reservas'
);

select * from finish();
rollback;
