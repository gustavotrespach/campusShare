-- T29 — Notificações dentro do app: cada gatilho gera o aviso certo para a pessoa certa (pagamento
-- confirmado, cancelamento de reserva paga e pendente, carona cancelada com 2 passageiros,
-- avaliação), nenhum aviso na expiração, sem duplicados, um aviso que falha não desfaz o pagamento,
-- RLS (cada um lê só as suas; escrita direta negada), marcar como lidas, contagem e anon negado.
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = Marcos (motorista de k1 e k2) · N = Nina (motorista de k3)
-- B = Bruna e C = Caio (passageiros em k1) · D = Davi e E = Eva (passageiros em k2)
-- G = Gil (reserva em k3 que expira) · H = Hugo (pagamento com o aviso quebrado)
-- Partidas fixas no futuro: 10/12/2030 às 19:00 (k1), 11/12 às 08:30 (k2) em Brasília
-- ------------------------------------------------------------

delete from public.reserva;
delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'm@teste.edu.br', '{"nome_completo": "Marcos Motorista"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br', '{"nome_completo": "Nina Souza"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@teste.edu.br', '{"nome_completo": "Bruna Lima"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@teste.edu.br', '{"nome_completo": "Caio Melo"}'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@teste.edu.br', '{"nome_completo": "Davi Rocha"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'e@teste.edu.br', '{"nome_completo": "Eva Prado"}'),
  ('10000000-0000-0000-0000-000000000001', 'g@teste.edu.br', '{"nome_completo": "Gil Dias"}'),
  ('10000000-0000-0000-0000-000000000002', 'h@teste.edu.br', '{"nome_completo": "Hugo Reis"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Onix', 'ABC1D23', 'Prata', 5),
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Gol', 'DEF4G56', 'Branco', 5);

insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
values
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
   'ULBRA Torres - RS', -29.329, -49.7365, '2030-12-10 22:00:00+00', 4, 4, 25, 10),
  ('70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
   'a1000000-0000-0000-0000-000000000001', 'ULBRA Torres - RS', -29.329, -49.7365,
   'Centro, Passo de Torres - SC', -29.31, -49.72, '2030-12-11 11:30:00+00', 3, 3, 24, 10),
  ('70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e',
   'e1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
   'ULBRA Torres - RS', -29.329, -49.7365, '2030-12-12 22:00:00+00', 3, 3, 24, 10);

create function public.teste_reserva(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql security definer set search_path = ''
as $$
  select r.id_reserva from public.reserva r
  where r.id_carona = p_id_carona and r.id_passageiro = p_id_passageiro
$$;
-- Paga a reserva como o webhook faria (T22 + T23)
create function public.teste_pagar(p_id_carona uuid, p_id_passageiro uuid, p_order text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id_pagamento uuid;
begin
  select p.id_pagamento into v_id_pagamento from public.pagamento p
  where p.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro);
  perform public.registrar_cobranca(v_id_pagamento, p_order);
  return public.confirmar_pagamento(
    p_order, v_id_pagamento,
    (select p.valor from public.pagamento p where p.id_pagamento = v_id_pagamento)
  );
end;
$$;
-- Avisos de uma pessoa, ignorando a RLS: "TIPO: mensagem", na ordem em que foram criados
create function public.teste_avisos(p_id_usuario uuid) returns setof text
language sql security definer set search_path = ''
as $$
  select n.tipo::text || ': ' || n.mensagem from public.notificacao n
  where n.id_usuario = p_id_usuario order by n.criado_em, n.tipo
$$;
create function public.teste_como(p_id_usuario uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id_usuario, 'role', 'authenticated')::text,
    true
  );
$$;
-- Id de um aviso de outra pessoa (o app não o veria pela RLS)
create function public.teste_id_aviso(p_id_usuario uuid, p_tipo text) returns uuid
language sql security definer set search_path = ''
as $$
  select n.id_notificacao from public.notificacao n
  where n.id_usuario = p_id_usuario and n.tipo::text = p_tipo
  limit 1
$$;
grant execute on function public.teste_reserva(uuid, uuid), public.teste_avisos(uuid),
  public.teste_como(uuid), public.teste_id_aviso(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Pagamento confirmado: RESERVA_CONFIRMADA ao passageiro e NOVA_RESERVA ao motorista
-- ------------------------------------------------------------

select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.notificacao),
  0,
  'reserva PENDENTE (Pix ainda não pago) não gera aviso'
);
select public.teste_pagar('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T291');

select results_eq(
  $$select * from public.teste_avisos('b0000000-0000-0000-0000-00000000000b')$$,
  $$values ('RESERVA_CONFIRMADA: Pagamento confirmado: sua vaga na carona para ULBRA Torres em 10/12 às 19:00 está garantida.'::text)$$,
  'pagamento confirmado: o passageiro recebe RESERVA_CONFIRMADA com o destino curto e a hora de Brasília'
);
select results_eq(
  $$select * from public.teste_avisos('a0000000-0000-0000-0000-00000000000a')$$,
  $$values ('NOVA_RESERVA: Bruna reservou uma vaga na sua carona para ULBRA Torres em 10/12 às 19:00.'::text)$$,
  'pagamento confirmado: o motorista recebe NOVA_RESERVA com o primeiro nome do passageiro'
);
select ok(
  (select bool_and(n.id_carona = '70000000-0000-0000-0000-000000000001'
     and n.id_reserva = public.teste_reserva('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')
     and not n.lida)
   from public.notificacao n),
  'os avisos guardam a carona e a reserva (para o app abrir a tela) e nascem não lidos'
);
select is(
  public.teste_pagar('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'ORDTST0000000000000000000000T291'),
  'JA_CONFIRMADO',
  'o webhook repetido não muda o status...'
);
select is(
  (select count(*)::int from public.notificacao),
  2,
  '...e não gera aviso duplicado'
);

-- ------------------------------------------------------------
-- Cancelamento pelo passageiro (carona ativa)
-- ------------------------------------------------------------

-- Caio reserva e desiste antes de pagar: nada para o motorista
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');
set local role authenticated;
select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select is(
  public.cancelar_reserva(public.teste_reserva('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c'))::text,
  'CANCELADA',
  'Caio cancela a reserva pendente'
);
reset role;
select is(
  (select count(*)::int from public.notificacao where tipo = 'RESERVA_CANCELADA'),
  0,
  'reserva PENDENTE cancelada: o motorista não é avisado'
);
select is(
  (select count(*)::int from public.teste_avisos('c0000000-0000-0000-0000-00000000000c')),
  0,
  'nem o próprio passageiro'
);

-- Bruna cancela a reserva paga: RESERVA_CANCELADA ao motorista
set local role authenticated;
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select is(
  public.cancelar_reserva(public.teste_reserva('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'))::text,
  'CANCELADA',
  'Bruna cancela a reserva paga'
);
reset role;
select results_eq(
  $$select n.tipo::text || ': ' || n.mensagem from public.notificacao n
    where n.id_usuario = 'a0000000-0000-0000-0000-00000000000a' and n.tipo = 'RESERVA_CANCELADA'$$,
  $$values ('RESERVA_CANCELADA: Bruna cancelou a reserva na sua carona para ULBRA Torres em 10/12 às 19:00. A vaga voltou a ficar livre.'::text)$$,
  'reserva CONFIRMADA cancelada: o motorista recebe RESERVA_CANCELADA'
);
select is(
  (select count(*)::int from public.teste_avisos('b0000000-0000-0000-0000-00000000000b')),
  1,
  'a Bruna não recebe aviso do próprio cancelamento (continua só com o da confirmação)'
);

-- ------------------------------------------------------------
-- Carona cancelada pelo motorista com 2 passageiros (um pago, um pendente)
-- ------------------------------------------------------------

select * from public.reservar_vaga('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000d');
select public.teste_pagar('70000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000d', 'ORDTST0000000000000000000000T292');
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000f');

create temp table antes_k2 as
  select count(*)::int as total from public.notificacao
  where id_usuario = 'a0000000-0000-0000-0000-00000000000a';

set local role authenticated;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select is(
  public.cancelar_carona('70000000-0000-0000-0000-000000000002'),
  2,
  'Marcos cancela a carona com as 2 reservas ativas'
);
reset role;

select results_eq(
  $$select n.id_usuario, n.mensagem from public.notificacao n
    where n.tipo = 'CARONA_CANCELADA' order by n.id_usuario$$,
  $$values
    ('d0000000-0000-0000-0000-00000000000d'::uuid, 'O motorista cancelou a carona para Centro, Passo de Torres em 11/12 às 08:30.'::varchar),
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 'O motorista cancelou a carona para Centro, Passo de Torres em 11/12 às 08:30.'::varchar)$$,
  'cada passageiro (pago e pendente) recebe um CARONA_CANCELADA, uma vez'
);
select is(
  (select count(*)::int from public.notificacao where id_usuario = 'a0000000-0000-0000-0000-00000000000a'),
  (select total from antes_k2),
  'o motorista não recebe RESERVA_CANCELADA pelas reservas da carona que ele cancelou'
);

-- ------------------------------------------------------------
-- Expiração: nenhum aviso
-- ------------------------------------------------------------

select * from public.reservar_vaga('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001');
update public.reserva set criado_em = now() - interval '16 minutes'
where id_reserva = public.teste_reserva('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001');
select is(public.expirar_reservas(), 1, 'a reserva do Gil expira');
select is(
  (select count(*)::int from public.notificacao
   where id_usuario in ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e')),
  0,
  'expiração: nenhum aviso ao passageiro nem ao motorista'
);

-- ------------------------------------------------------------
-- Avaliação: AVALIACAO ao avaliado
-- ------------------------------------------------------------

insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota)
values (public.teste_reserva('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
        'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 5);
insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota)
values (public.teste_reserva('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
        'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 1);

select results_eq(
  $$select n.mensagem::text from public.notificacao n
    where n.tipo = 'AVALIACAO' order by n.id_usuario$$,
  $$values
    ('Você recebeu uma avaliação de 5 estrelas pela carona para ULBRA Torres em 10/12 às 19:00.'::text),
    ('Você recebeu uma avaliação de 1 estrela pela carona para ULBRA Torres em 10/12 às 19:00.'::text)$$,
  'cada avaliado recebe AVALIACAO com a nota (singular em 1 estrela)'
);
select ok(
  (select bool_and(n.id_usuario <> a.id_avaliador)
   from public.notificacao n join public.avaliacao a on a.id_avaliado = n.id_usuario and a.id_reserva = n.id_reserva
   where n.tipo = 'AVALIACAO'),
  'o aviso vai para o avaliado, nunca para quem avaliou'
);

-- ------------------------------------------------------------
-- Sem duplicados e o aviso que falha não desfaz o pagamento
-- ------------------------------------------------------------

select is(
  (select count(*)::int from (
     select id_usuario, tipo, id_reserva from public.notificacao
     group by id_usuario, tipo, id_reserva having count(*) > 1) d),
  0,
  'nenhum aviso duplicado (pessoa, tipo e reserva)'
);

-- Quebra a gravação de avisos (toda linha nova viola a regra) e paga a reserva do Hugo
select * from public.reservar_vaga('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
alter table public.notificacao add constraint teste_quebra check (false) not valid;
select is(
  public.teste_pagar('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'ORDTST0000000000000000000000T293'),
  'CONFIRMADO',
  'com o aviso falhando, o pagamento é confirmado mesmo assim'
);
select is(
  (select r.status::text from public.reserva r
   where r.id_reserva = public.teste_reserva('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')),
  'CONFIRMADA',
  'a reserva do Hugo fica CONFIRMADA (o gatilho não desfaz o pagamento)'
);
select is(
  (select count(*)::int from public.teste_avisos('10000000-0000-0000-0000-000000000002')),
  0,
  '...e só o aviso dele não foi gravado'
);
alter table public.notificacao drop constraint teste_quebra;

-- ------------------------------------------------------------
-- RLS: cada um lê só as suas; escrita direta negada
-- ------------------------------------------------------------

set local role authenticated;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select is(
  (select count(*)::int from public.notificacao),
  (select count(*)::int from public.teste_avisos('a0000000-0000-0000-0000-00000000000a')),
  'o motorista lê só as próprias notificações'
);
select is(
  (select count(*)::int from public.notificacao where id_usuario <> 'a0000000-0000-0000-0000-00000000000a'),
  0,
  'nenhuma notificação de outra pessoa aparece'
);
select throws_ok(
  $$insert into public.notificacao (id_usuario, tipo, mensagem)
    values ('a0000000-0000-0000-0000-00000000000a', 'AVALIACAO', 'falsa')$$,
  '42501', null, 'o app não insere notificação'
);
select throws_ok(
  $$update public.notificacao set lida = true$$,
  '42501', null, 'o app não altera notificação direto (lida só pela RPC)'
);
select throws_ok(
  $$delete from public.notificacao$$,
  '42501', null, 'o app não apaga notificação'
);

-- ------------------------------------------------------------
-- contar_notificacoes_nao_lidas e marcar_notificacoes_lidas
-- ------------------------------------------------------------

-- Marcos: 2 NOVA_RESERVA (Bruna e Davi), RESERVA_CANCELADA e AVALIACAO (o NOVA_RESERVA do Hugo
-- falhou de propósito)
select is(public.contar_notificacoes_nao_lidas(), 4, 'contagem: 4 não lidas do Marcos');
select is(
  public.marcar_notificacoes_lidas(array[
    (select n.id_notificacao from public.notificacao n
     where n.tipo = 'NOVA_RESERVA' and n.id_carona = '70000000-0000-0000-0000-000000000001'),
    public.teste_id_aviso('d0000000-0000-0000-0000-00000000000d', 'CARONA_CANCELADA')
  ]),
  1,
  'marcar algumas: só a do próprio usuário conta (a do Davi, no meio, é ignorada)'
);
select is(public.contar_notificacoes_nao_lidas(), 3, 'contagem cai para 3');
select is(
  public.marcar_notificacoes_lidas(array[
    (select n.id_notificacao from public.notificacao n where n.tipo = 'AVALIACAO')
  ]),
  1,
  'marcar uma por id'
);
select is(public.marcar_notificacoes_lidas(), 2, 'marcar todas (null): as 2 que faltavam');
select is(public.contar_notificacoes_nao_lidas(), 0, 'nenhuma não lida');
select is(public.marcar_notificacoes_lidas(), 0, 'marcar todas de novo: 0');
select is(
  public.marcar_notificacoes_lidas(array[
    public.teste_id_aviso('d0000000-0000-0000-0000-00000000000d', 'CARONA_CANCELADA')
  ]),
  0,
  'o Marcos não marca a notificação do Davi'
);
reset role;
select is(
  (select count(*)::int from public.notificacao
   where id_usuario = 'd0000000-0000-0000-0000-00000000000d' and lida),
  0,
  'as notificações do Davi continuam não lidas depois das chamadas do Marcos'
);

-- ------------------------------------------------------------
-- Acesso
-- ------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.contar_notificacoes_nao_lidas()$$,
  'PT401', 'NAO_AUTENTICADO', 'contar sem auth.uid(): NAO_AUTENTICADO'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select count(*) from public.notificacao$$, '42501', null, 'anon não lê notificacao');
select throws_ok(
  $$select public.marcar_notificacoes_lidas()$$,
  '42501', null, 'anon não executa marcar_notificacoes_lidas'
);
reset role;

select * from finish();
rollback;
