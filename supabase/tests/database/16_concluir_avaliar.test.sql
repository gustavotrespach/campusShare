-- T30 — concluir_carona (motorista, prazo de 1 dia), job concluir-caronas, avaliar_participante
-- (RN19, prazo de 7 dias), RLS de AVALIACAO, avaliacoes_pendentes, perfil_publico, reputação no
-- detalhar_carona e acesso. Horários relativos a now() (fixo dentro da transação do teste).
begin;
create extension if not exists pgtap with schema extensions;

select plan(69);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = Marcos (motorista) a0…0a · N = Nina e0…0e · P = Paula b0…0b · Q = Quintino f0…0f
-- R = Rita c0…0c · S = Sara d0…0d · T = Tiago 70…07
-- k1: -2 h (P e Q confirmadas, R pendente, S cancelada, T expirada) · k2: amanhã · k3: -25 h
-- k4: cancelada · k5: -24 h exatas (T confirmada) · k6: -30 h, LOTADA (P confirmada)
-- k7: -23 h (P confirmada) · k8: amanhã · k9: -8 dias, CONCLUIDA (Q confirmada)
-- ------------------------------------------------------------

delete from public.carona;

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'm@teste.edu.br', '{"nome_completo": "Marcos Motorista"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'n@teste.edu.br', '{"nome_completo": "Nina Silva"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'p@teste.edu.br', '{"nome_completo": "Paula Passageira"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'q@teste.edu.br', '{"nome_completo": "Quintino Souza"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'r@teste.edu.br', '{"nome_completo": "Rita"}'),
  ('d0000000-0000-0000-0000-00000000000d', 's@teste.edu.br', '{"nome_completo": "Sara"}'),
  ('70000000-0000-0000-0000-000000000007', 't@teste.edu.br', '{"nome_completo": "Tiago Lima"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Spin', 'ABC1D23', 'Prata', 7);

-- Todas nascem no futuro (a reservar_vaga só aceita partida futura); a partida é recuada depois
insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min
)
select ('60000000-0000-0000-0000-00000000000' || n)::uuid, 'a0000000-0000-0000-0000-00000000000a',
       'a1000000-0000-0000-0000-000000000001', 'Centro, Torres - RS', -29.3353, -49.7268,
       'ULBRA Torres - RS', -29.329, -49.7365, now() + interval '1 day', vagas, vagas, 24, 10
from (values (1, 5), (2, 3), (3, 3), (4, 3), (5, 3), (6, 1), (7, 3), (8, 3), (9, 3)) as c (n, vagas);

-- Apoio (security definer: também servem enquanto o papel é authenticated)
create function public.teste_como(p_id_usuario uuid) returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id_usuario, 'role', 'authenticated')::text,
    true
  );
$$;
create function public.teste_reserva(p_id_carona uuid, p_id_passageiro uuid) returns uuid
language sql security definer set search_path = ''
as $$
  select r.id_reserva from public.reserva r
  where r.id_carona = p_id_carona and r.id_passageiro = p_id_passageiro
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
  select c.status::text from public.carona c where c.id_carona = p_id_carona
$$;
create function public.teste_pagar(p_id_carona uuid, p_id_passageiro uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id_pagamento uuid := (
    select p.id_pagamento from public.pagamento p
    where p.id_reserva = public.teste_reserva(p_id_carona, p_id_passageiro)
  );
  v_order text := 'ORDTST' || replace(v_id_pagamento::text, '-', '');
begin
  perform public.registrar_cobranca(v_id_pagamento, v_order);
  return public.confirmar_pagamento(
    v_order, v_id_pagamento,
    (select p.valor from public.pagamento p where p.id_pagamento = v_id_pagamento)
  );
end;
$$;
grant execute on function public.teste_como(uuid), public.teste_reserva(uuid, uuid),
  public.teste_status(uuid, uuid), public.teste_carona(uuid) to authenticated, anon;

-- Reservas e pagamentos (como a Edge Function e o webhook fariam)
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select public.teste_pagar('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f');
select public.teste_pagar('60000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d');
select public.teste_como('d0000000-0000-0000-0000-00000000000d');
select public.cancelar_reserva(public.teste_reserva('60000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d'));
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007');
update public.reserva set criado_em = now() - interval '16 minutes'
where id_reserva = public.teste_reserva('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007');
select public.expirar_reservas();
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select public.cancelar_carona('60000000-0000-0000-0000-000000000004');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007');
select public.teste_pagar('60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b');
select public.teste_pagar('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-00000000000b');
select public.teste_pagar('60000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-00000000000b');
select * from public.reservar_vaga('60000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000000f');
select public.teste_pagar('60000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000000f');

-- O relógio: recua as partidas
update public.carona c
set data_hora_partida = now() + p.recuo,
    status = coalesce(p.status, c.status)
from (values
  (1, interval '-2 hours', null::public.status_carona),
  (3, interval '-25 hours', null),
  (5, interval '-24 hours', null),
  (6, interval '-30 hours', null),
  (7, interval '-23 hours', null),
  (9, interval '-8 days', 'CONCLUIDA')
) as p (n, recuo, status)
where c.id_carona = ('60000000-0000-0000-0000-00000000000' || p.n)::uuid;

select is(
  (select string_agg(n || ':' || public.teste_carona(('60000000-0000-0000-0000-00000000000' || n)::uuid), ' ' order by n)
   from generate_series(1, 9) n),
  '1:ABERTA 2:ABERTA 3:ABERTA 4:CANCELADA 5:ABERTA 6:LOTADA 7:ABERTA 8:ABERTA 9:CONCLUIDA',
  'antes: status das caronas'
);

-- ============================================================
-- concluir_carona
-- ============================================================

set local role authenticated;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000002')$$,
  'PT409', 'CARONA_NAO_PARTIU', 'antes da partida: CARONA_NAO_PARTIU'
);
select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000003')$$,
  'PT409', 'CONCLUSAO_ENCERRADA', 'mais de 1 dia depois da partida: CONCLUSAO_ENCERRADA'
);
select is(
  public.concluir_carona('60000000-0000-0000-0000-000000000001'),
  2,
  'o motorista conclui 2 h depois da partida e recebe as 2 reservas confirmadas'
);
select is(public.teste_carona('60000000-0000-0000-0000-000000000001'), 'CONCLUIDA', 'a carona fica CONCLUIDA');
select is(
  public.teste_status('60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c') || ' ' || public.teste_status('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  'PENDENTE/PENDENTE CONFIRMADA/APROVADO',
  'reservas e pagamentos não mudam'
);
select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000001')$$,
  'PT409', 'CARONA_JA_ENCERRADA', 'concluir de novo: CARONA_JA_ENCERRADA'
);
select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000004')$$,
  'PT409', 'CARONA_JA_ENCERRADA', 'carona CANCELADA: CARONA_JA_ENCERRADA'
);
select is(public.concluir_carona('60000000-0000-0000-0000-000000000005'), 1, 'exatamente 1 dia depois da partida ainda conclui');

select public.teste_como('e0000000-0000-0000-0000-00000000000e');
select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000007')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'outro motorista: CARONA_NAO_ENCONTRADA'
);
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.concluir_carona('60000000-0000-0000-0000-000000000007')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'passageiro: CARONA_NAO_ENCONTRADA'
);
select is(public.teste_carona('60000000-0000-0000-0000-000000000007'), 'ABERTA', 'a carona dos outros não mudou');
reset role;

-- A frase do prazo vem do prazo_conclusao_carona
create temporary table dicas (caso text, dica text) on commit drop;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
do $$
declare
  v_dica text;
begin
  perform public.concluir_carona('60000000-0000-0000-0000-000000000003');
exception when others then
  get stacked diagnostics v_dica = pg_exception_hint;
  insert into dicas values ('conclusao', v_dica);
end;
$$;
select is(
  (select dica from dicas where caso = 'conclusao'),
  'O prazo para concluir esta carona era de 1 dia depois da partida. Ela é concluída automaticamente.',
  'o hint do CONCLUSAO_ENCERRADA diz o prazo'
);

-- ============================================================
-- Job concluir-caronas
-- ============================================================

select is(public.concluir_caronas_vencidas(), 2, 'o job conclui as 2 vencidas (k3 ABERTA e k6 LOTADA)');
select is(
  (select string_agg(n || ':' || public.teste_carona(('60000000-0000-0000-0000-00000000000' || n)::uuid), ' ' order by n)
   from generate_series(1, 9) n),
  '1:CONCLUIDA 2:ABERTA 3:CONCLUIDA 4:CANCELADA 5:CONCLUIDA 6:CONCLUIDA 7:ABERTA 8:ABERTA 9:CONCLUIDA',
  'só as vencidas mudam: 23 h depois (k7) e futuras continuam ABERTA; cancelada não muda'
);
select is(public.concluir_caronas_vencidas(), 0, 'rodar de novo não conclui nada');
select is(
  (select schedule from cron.job where jobname = 'concluir-caronas'),
  '0 * * * *',
  'o job concluir-caronas está no pg_cron, de hora em hora'
);
select is(
  (select command from cron.job where jobname = 'concluir-caronas'),
  'select public.concluir_caronas_vencidas()',
  'o job chama a concluir_caronas_vencidas'
);
select cron.schedule('concluir-caronas', '0 * * * *', $$select public.concluir_caronas_vencidas()$$);
select is(
  (select count(*)::int from cron.job where jobname = 'concluir-caronas'),
  1,
  'agendar de novo não duplica o job'
);

-- ============================================================
-- avaliacoes_pendentes (antes de avaliar)
-- ============================================================

set local role authenticated;
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select papel, nome_avaliado, origem, destino from public.avaliacoes_pendentes()
    order by nome_avaliado, data_hora_partida$$,
  $$values ('MOTORISTA', 'Paula', 'Centro, Torres - RS', 'ULBRA Torres - RS'),
           ('MOTORISTA', 'Paula', 'Centro, Torres - RS', 'ULBRA Torres - RS'),
           ('MOTORISTA', 'Quintino', 'Centro, Torres - RS', 'ULBRA Torres - RS'),
           ('MOTORISTA', 'Tiago', 'Centro, Torres - RS', 'ULBRA Torres - RS')$$,
  'motorista: P (k1 e k6), Q (k1) e T (k5), só o primeiro nome; k9 (prazo) e k7 (não concluída) fora'
);
select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select results_eq(
  $$select id_reserva, papel, nome_avaliado, avaliar_ate = data_hora_partida + interval '7 days'
    from public.avaliacoes_pendentes()$$,
  $$values (public.teste_reserva('60000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f'), 'PASSAGEIRO', 'Marcos', true)$$,
  'passageiro: a reserva da k1, para avaliar Marcos até 7 dias depois da partida'
);

-- ============================================================
-- avaliar_participante
-- ============================================================

select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select isnt(
  public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'), 5),
  null,
  'passageiro avalia a carona concluída (devolve o id)'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 4)', public.teste_reserva('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')),
  'PT409', 'AVALIACAO_DUPLICADA', 'segunda avaliação da mesma reserva: AVALIACAO_DUPLICADA'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 4)', public.teste_reserva('60000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-00000000000b')),
  'PT409', 'AVALIACAO_INDISPONIVEL', 'carona ainda não concluída: AVALIACAO_INDISPONIVEL'
);
select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select isnt(
  public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000f'), 4, '  Pontual  '),
  null,
  'outro passageiro avalia com comentário'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 5)', public.teste_reserva('60000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000000f')),
  'PT409', 'PRAZO_AVALIACAO_ENCERRADO', 'mais de 7 dias depois da partida: PRAZO_AVALIACAO_ENCERRADO'
);
select public.teste_como('70000000-0000-0000-0000-000000000007');
select isnt(public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007'), 4), null, 'T avalia a k5');
select throws_ok(
  format('select public.avaliar_participante(%L, 5)', public.teste_reserva('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007')),
  'PT409', 'AVALIACAO_INDISPONIVEL', 'reserva EXPIRADA: AVALIACAO_INDISPONIVEL'
);
select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select throws_ok(
  format('select public.avaliar_participante(%L, 5)', public.teste_reserva('60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c')),
  'PT409', 'AVALIACAO_INDISPONIVEL', 'reserva PENDENTE: AVALIACAO_INDISPONIVEL'
);
select public.teste_como('d0000000-0000-0000-0000-00000000000d');
select throws_ok(
  format('select public.avaliar_participante(%L, 5)', public.teste_reserva('60000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d')),
  'PT409', 'AVALIACAO_INDISPONIVEL', 'reserva CANCELADA: AVALIACAO_INDISPONIVEL'
);
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select isnt(
  public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'), 3, '   '),
  null,
  'motorista avalia a passageira da mesma reserva'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 0)', public.teste_reserva('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b')),
  'PT422', 'NOTA_INVALIDA', 'nota 0: NOTA_INVALIDA'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 6)', public.teste_reserva('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b')),
  'PT422', 'NOTA_INVALIDA', 'nota 6: NOTA_INVALIDA'
);
select throws_ok(
  format('select public.avaliar_participante(%L, 4, %L)', public.teste_reserva('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b'), repeat('a', 501)),
  'PT400', 'DADOS_INVALIDOS', 'comentário de 501 caracteres: DADOS_INVALIDOS'
);
select isnt(
  public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b'), 4, repeat('a', 500)),
  null,
  'comentário de 500 caracteres passa'
);
select public.teste_como('e0000000-0000-0000-0000-00000000000e');
select throws_ok(
  format('select public.avaliar_participante(%L, 5)', public.teste_reserva('60000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')),
  'PT404', 'RESERVA_NAO_ENCONTRADA', 'quem não participa: RESERVA_NAO_ENCONTRADA'
);
select throws_ok(
  $$select public.avaliar_participante('99999999-0000-0000-0000-000000000000', 5)$$,
  'PT404', 'RESERVA_NAO_ENCONTRADA', 'reserva inexistente: RESERVA_NAO_ENCONTRADA'
);
reset role;

-- O avaliado é deduzido de quem avalia
select results_eq(
  $$select r.id_passageiro, a.id_avaliador, a.id_avaliado, a.nota::int, a.comentario::text
    from public.avaliacao a join public.reserva r using (id_reserva)
    where r.id_carona = '60000000-0000-0000-0000-000000000001'
    order by a.id_avaliador, a.id_avaliado$$,
  $$values
    ('b0000000-0000-0000-0000-00000000000b'::uuid, 'a0000000-0000-0000-0000-00000000000a'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid, 3, null::text),
    ('b0000000-0000-0000-0000-00000000000b'::uuid, 'b0000000-0000-0000-0000-00000000000b'::uuid, 'a0000000-0000-0000-0000-00000000000a'::uuid, 5, null::text),
    ('f0000000-0000-0000-0000-00000000000f'::uuid, 'f0000000-0000-0000-0000-00000000000f'::uuid, 'a0000000-0000-0000-0000-00000000000a'::uuid, 4, 'Pontual')$$,
  'passageiro → motorista e motorista → passageiro; comentário aparado e vazio vira null'
);

select public.teste_como('f0000000-0000-0000-0000-00000000000f');
do $$
declare
  v_dica text;
begin
  perform public.avaliar_participante(public.teste_reserva('60000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000000f'), 5);
exception when others then
  get stacked diagnostics v_dica = pg_exception_hint;
  insert into dicas values ('avaliacao', v_dica);
end;
$$;
select is(
  (select dica from dicas where caso = 'avaliacao'),
  'O prazo para avaliar esta carona era de 7 dias depois da partida.',
  'o hint do PRAZO_AVALIACAO_ENCERRADO diz o prazo'
);

-- ============================================================
-- avaliacoes_pendentes (depois de avaliar)
-- ============================================================

set local role authenticated;
select public.teste_como('f0000000-0000-0000-0000-00000000000f');
select is(
  (select count(*)::int from public.avaliacoes_pendentes()),
  0,
  'passageiro: some depois de avaliar (e a k9, fora do prazo, nunca aparece)'
);
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select id_reserva from public.avaliacoes_pendentes()$$,
  $$values (public.teste_reserva('60000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-00000000000b'))$$,
  'passageira: resta só a k6'
);
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select nome_avaliado from public.avaliacoes_pendentes()$$,
  $$values ('Quintino'), ('Tiago')$$,
  'motorista: restam Q (k1) e T (k5), a partida mais recente antes'
);

-- ============================================================
-- RLS de AVALIACAO
-- ============================================================

select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.avaliacao),
  1,
  'P lê só a avaliação que fez (não a que recebeu)'
);
select public.teste_como('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.avaliacao), 2, 'M lê as 2 que fez');
select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.avaliacao), 0, 'R não lê nenhuma');
select throws_ok(
  format(
    'insert into public.avaliacao (id_reserva, id_avaliador, id_avaliado, nota) values (%L, %L, %L, 5)',
    public.teste_reserva('60000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c'), 'c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a'
  ),
  '42501', null, 'INSERT direto negado'
);
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$update public.avaliacao set nota = 1$$,
  '42501', null, 'UPDATE direto negado'
);
select throws_ok(
  $$delete from public.avaliacao$$,
  '42501', null, 'DELETE direto negado'
);

-- ============================================================
-- perfil_publico e detalhar_carona
-- ============================================================

select public.teste_como('c0000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select nome, media_avaliacoes, total_avaliacoes from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')$$,
  $$values ('Marcos Motorista'::text, 4.3::numeric, 3)$$,
  'perfil do motorista: média de 5, 4 e 4 com 1 casa (4,3) e 3 avaliações'
);
select results_eq(
  $$select media_avaliacoes, total_avaliacoes from public.perfil_publico('b0000000-0000-0000-0000-00000000000b')$$,
  $$values (3.5::numeric, 2)$$,
  'perfil da passageira: média 3,5 de 2 avaliações'
);
select results_eq(
  $$select media_avaliacoes, total_avaliacoes from public.perfil_publico('c0000000-0000-0000-0000-00000000000c')$$,
  $$values (null::numeric, 0)$$,
  'sem avaliações: média nula e total 0'
);
select throws_ok(
  $$select * from public.perfil_publico('99999999-0000-0000-0000-000000000000')$$,
  'PT404', 'USUARIO_NAO_ENCONTRADO', 'usuário inexistente'
);
select public.teste_como('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$select media_motorista, total_avaliacoes_motorista
    from public.detalhar_carona('60000000-0000-0000-0000-000000000001')$$,
  $$values (4.3::numeric, 3)$$,
  'detalhar_carona traz a média e o total do motorista'
);
reset role;

select is(
  pg_get_function_result('public.perfil_publico(uuid)'::regprocedure),
  'TABLE(id_usuario uuid, nome text, media_avaliacoes numeric, total_avaliacoes integer)',
  'perfil_publico não devolve e-mail, telefone nem gênero'
);

-- ============================================================
-- Acesso
-- ============================================================

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok($$select public.concluir_carona('60000000-0000-0000-0000-000000000002')$$, 'PT401', 'NAO_AUTENTICADO', 'concluir_carona sem sessão');
select throws_ok($$select public.avaliar_participante('60000000-0000-0000-0000-000000000002', 5)$$, 'PT401', 'NAO_AUTENTICADO', 'avaliar_participante sem sessão');
select throws_ok($$select * from public.avaliacoes_pendentes()$$, 'PT401', 'NAO_AUTENTICADO', 'avaliacoes_pendentes sem sessão');
select throws_ok($$select * from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')$$, 'PT401', 'NAO_AUTENTICADO', 'perfil_publico sem sessão');
select throws_ok($$select public.concluir_caronas_vencidas()$$, '42501', null, 'authenticated não executa concluir_caronas_vencidas');
select throws_ok($$select public.prazo_conclusao_carona()$$, '42501', null, 'authenticated não executa prazo_conclusao_carona');
select throws_ok($$select public.prazo_avaliacao()$$, '42501', null, 'authenticated não executa prazo_avaliacao');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select public.concluir_carona('60000000-0000-0000-0000-000000000002')$$, '42501', null, 'anon não executa concluir_carona');
select throws_ok($$select public.concluir_caronas_vencidas()$$, '42501', null, 'anon não executa concluir_caronas_vencidas');
select throws_ok($$select public.avaliar_participante('60000000-0000-0000-0000-000000000002', 5)$$, '42501', null, 'anon não executa avaliar_participante');
select throws_ok($$select * from public.avaliacoes_pendentes()$$, '42501', null, 'anon não executa avaliacoes_pendentes');
select throws_ok($$select * from public.perfil_publico('a0000000-0000-0000-0000-00000000000a')$$, '42501', null, 'anon não executa perfil_publico');
select throws_ok($$select count(*) from public.avaliacao$$, '42501', null, 'anon não lê avaliacao');
reset role;

select is(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in (
     'public.concluir_carona(uuid)'::regprocedure,
     'public.concluir_caronas_vencidas()'::regprocedure,
     'public.avaliar_participante(uuid, int, text)'::regprocedure,
     'public.avaliacoes_pendentes()'::regprocedure,
     'public.perfil_publico(uuid)'::regprocedure,
     'public.detalhar_carona(uuid)'::regprocedure
   )),
  true,
  'as funções novas são security definer com search_path vazio'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.avaliacao'::regclass),
  'RLS habilitada em avaliacao'
);

select * from finish();
rollback;
