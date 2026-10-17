-- T21 — reservar_vaga: rateio (RN11) e taxa (RN13), última vaga e LOTADA (RN07), RN08, RN14,
-- RN18, reserva dupla, atomicidade, acesso só da service_role e leitura pela RLS.
-- A concorrência real (duas sessões na última vaga) fica em tests/concorrencia/ultima_vaga.sh.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- M = motorista a0...0a · H = MASCULINO b0...0b · F = FEMININO f0...0f · N = NAO_INFORMADO c0...0c
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista@teste.edu.br',
   '{"nome_completo": "Motorista M", "genero": "MASCULINO"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'passageiro@teste.edu.br',
   '{"nome_completo": "Passageiro H", "genero": "MASCULINO"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'passageira@teste.edu.br',
   '{"nome_completo": "Passageira F", "genero": "FEMININO"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'nao.informado@teste.edu.br',
   '{"nome_completo": "Passageiro N"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Onix', 'ABC1D23', 'Prata', 5);

create function pg_temp.carona(
  p_id uuid,
  p_custo numeric,
  p_ofertadas int,
  p_disponiveis int,
  p_status public.status_carona default 'ABERTA',
  p_somente_mulheres boolean default false,
  p_partida timestamptz default now() + interval '1 day'
) returns void
language sql
as $$
  insert into public.carona (
    id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
    destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total,
    tolerancia_min, somente_mulheres, status
  ) values (
    p_id, 'a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
    'Centro, Torres', -29.3353, -49.7268, 'ULBRA Torres', -29.329, -49.7365, p_partida,
    p_ofertadas, p_disponiveis, p_custo, 10, p_somente_mulheres, p_status
  );
$$;

select pg_temp.carona('20000000-0000-0000-0000-000000000001', 24, 3, 3);  -- caminho feliz
select pg_temp.carona('20000000-0000-0000-0000-000000000002', 25, 2, 2);  -- arredondamento
select pg_temp.carona('20000000-0000-0000-0000-000000000003', 24, 3, 3, p_somente_mulheres => true);
select pg_temp.carona('20000000-0000-0000-0000-000000000004', 24, 3, 3, 'CANCELADA');
select pg_temp.carona(
  '20000000-0000-0000-0000-000000000005', 24, 3, 3, p_partida => now() - interval '1 hour'
);
select pg_temp.carona('20000000-0000-0000-0000-000000000006', 24, 2, 1);  -- última vaga
select pg_temp.carona('20000000-0000-0000-0000-000000000007', 0.01, 3, 3); -- R$ 0,00 por pessoa

-- "message | hint" do erro, para conferir a frase que o app mostra
create function pg_temp.erro(p_id_carona uuid, p_id_passageiro uuid)
returns text
language plpgsql
as $$
declare
  v_mensagem text;
  v_hint text;
begin
  perform public.reservar_vaga(p_id_carona, p_id_passageiro);
  return 'sem erro';
exception when others then
  get stacked diagnostics v_mensagem = message_text, v_hint = pg_exception_hint;
  return v_mensagem || ' | ' || v_hint;
end;
$$;

-- ------------------------------------------------------------
-- Estrutura e acesso
-- ------------------------------------------------------------

select has_function('public', 'reservar_vaga', array['uuid', 'uuid'], 'reservar_vaga existe');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.reservar_vaga'::regproc),
  'reservar_vaga é SECURITY DEFINER com search_path vazio'
);
select ok(
  has_function_privilege('service_role', 'public.reservar_vaga(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.reservar_vaga(uuid, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.reservar_vaga(uuid, uuid)', 'execute'),
  'só a service_role tem EXECUTE em reservar_vaga'
);

-- ------------------------------------------------------------
-- Como service_role (a Edge Function da T22)
-- ------------------------------------------------------------

set local role service_role;

-- Caminho feliz: R$ 24,00 com 3 vagas → 4 ocupantes
select results_eq(
  $$select valor_individual, taxa_plataforma, valor_repassado, status::text
    from public.reservar_vaga('20000000-0000-0000-0000-000000000001',
                              'b0000000-0000-0000-0000-00000000000b')$$,
  $$values (6.00, 0.60, 5.40, 'PENDENTE')$$,
  'R$ 24,00 com 3 vagas: R$ 6,00 por passageiro, taxa de R$ 0,60 e repasse de R$ 5,40'
);
select results_eq(
  $$select r.status::text, r.valor_individual, p.status::text, p.metodo::text,
      p.id_externo is null, p.valor, p.taxa_plataforma, p.valor_repassado, p.pago_em is null
    from public.reserva r join public.pagamento p on p.id_reserva = r.id_reserva
    where r.id_carona = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('PENDENTE', 6.00, 'PENDENTE', 'PIX', true, 6.00, 0.60, 5.40, true)$$,
  'reserva e pagamento PENDENTE gravados juntos, sem cobrança (id_externo) ainda'
);
select results_eq(
  $$select vagas_disponiveis::int, status::text from public.carona
    where id_carona = '20000000-0000-0000-0000-000000000001'$$,
  $$values (2, 'ABERTA')$$,
  'a reserva PENDENTE já ocupa a vaga (3 → 2), carona continua ABERTA'
);

-- Arredondamento: R$ 25,00 com 2 vagas → 3 ocupantes
select results_eq(
  $$select valor_individual, taxa_plataforma, valor_repassado
    from public.reservar_vaga('20000000-0000-0000-0000-000000000002',
                              'f0000000-0000-0000-0000-00000000000f')$$,
  $$values (8.33, 0.83, 7.50)$$,
  'R$ 25,00 com 2 vagas: R$ 8,33, taxa de R$ 0,83 e repasse de R$ 7,50'
);

-- Última vaga
select lives_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000006',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'reserva da última vaga é aceita'
);
select results_eq(
  $$select vagas_disponiveis::int, status::text from public.carona
    where id_carona = '20000000-0000-0000-0000-000000000006'$$,
  $$values (0, 'LOTADA')$$,
  'sem vagas, a carona vira LOTADA (RN07)'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000006',
                                       'f0000000-0000-0000-0000-00000000000f')$$,
  'PT409', 'CARONA_LOTADA', 'nova tentativa na carona LOTADA é recusada'
);

-- Erros
select throws_ok(
  $$select * from public.reservar_vaga('99999999-0000-0000-0000-000000000000',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT404', 'CARONA_NAO_ENCONTRADA', 'carona inexistente'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000001',
                                       '99999999-0000-0000-0000-000000000000')$$,
  'PT404', 'USUARIO_NAO_ENCONTRADO', 'passageiro sem perfil'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000001',
                                       'a0000000-0000-0000-0000-00000000000a')$$,
  'PT422', 'RESERVA_PROPRIA_CARONA', 'motorista não reserva a própria carona (RN14)'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000003',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT403', 'CARONA_SOMENTE_MULHERES', 'MASCULINO não reserva carona somente_mulheres (RN18)'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000003',
                                       'c0000000-0000-0000-0000-00000000000c')$$,
  'PT403', 'CARONA_SOMENTE_MULHERES', 'NAO_INFORMADO também não (RN18)'
);
select lives_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000003',
                                       'f0000000-0000-0000-0000-00000000000f')$$,
  'FEMININO reserva carona somente_mulheres'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000004',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT409', 'CARONA_INDISPONIVEL', 'carona cancelada não aceita reserva'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000005',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT409', 'CARONA_INDISPONIVEL', 'carona com partida passada não aceita reserva (RN08)'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000001',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT409', 'RESERVA_DUPLICADA', 'segunda reserva ativa do mesmo passageiro é recusada (RN14)'
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000007',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'PT422', 'VALOR_ABAIXO_DO_MINIMO', 'carona com menos de 1 centavo por ocupante não gera reserva'
);
select results_eq(
  $$select vagas_disponiveis::int from public.carona
    where id_carona = '20000000-0000-0000-0000-000000000001'$$,
  $$values (2)$$,
  'tentativas recusadas não mexem nas vagas'
);

-- Depois de CANCELADA, o mesmo passageiro reserva de novo
update public.reserva set status = 'CANCELADA'
where id_carona = '20000000-0000-0000-0000-000000000001'
  and id_passageiro = 'b0000000-0000-0000-0000-00000000000b';
select lives_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000001',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  'nova reserva depois de uma CANCELADA é aceita'
);
select results_eq(
  $$select status::text from public.reserva
    where id_carona = '20000000-0000-0000-0000-000000000001'
      and id_passageiro = 'b0000000-0000-0000-0000-00000000000b'
    order by criado_em, status$$,
  $$values ('CANCELADA'), ('PENDENTE')$$,
  'o histórico mantém a CANCELADA e a nova PENDENTE'
);
select is(
  (select count(*) from public.pagamento p join public.reserva r using (id_reserva)
   where r.id_carona in ('20000000-0000-0000-0000-000000000001',
                         '20000000-0000-0000-0000-000000000002',
                         '20000000-0000-0000-0000-000000000003',
                         '20000000-0000-0000-0000-000000000006')),
  (select count(*) from public.reserva
   where id_carona in ('20000000-0000-0000-0000-000000000001',
                       '20000000-0000-0000-0000-000000000002',
                       '20000000-0000-0000-0000-000000000003',
                       '20000000-0000-0000-0000-000000000006')),
  'toda reserva criada tem exatamente um pagamento'
);

-- ------------------------------------------------------------
-- Valor igual ao da busca (como postgres, com o JWT de N para auth.uid())
-- ------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub": "c0000000-0000-0000-0000-00000000000c", "role": "authenticated"}',
  true
);
select is(
  (select b.valor_por_passageiro from public.buscar_caronas(-29.3353, -49.7268) b
   where b.id_carona = '20000000-0000-0000-0000-000000000002'),
  (select r.valor_individual from public.reserva r
   where r.id_carona = '20000000-0000-0000-0000-000000000002'),
  'o valor cobrado na reserva é o mesmo que a busca mostrou'
);
select is(
  pg_temp.erro('20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-00000000000f'),
  'CARONA_LOTADA | Esta carona não tem mais vagas.',
  'CARONA_LOTADA traz a frase do API.md no hint'
);
select is(
  pg_temp.erro('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  'RESERVA_PROPRIA_CARONA | Você não pode reservar uma vaga na sua própria carona.',
  'RESERVA_PROPRIA_CARONA traz frase em pt-BR'
);

-- ------------------------------------------------------------
-- O app não chama a função; lê o resultado pela RLS
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "b0000000-0000-0000-0000-00000000000b", "role": "authenticated"}',
  true
);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000002',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'authenticated não executa reservar_vaga'
);
select is(
  (select count(*) from public.reserva
   where id_carona = '20000000-0000-0000-0000-000000000001'),
  2::bigint,
  'passageiro lê as próprias reservas (a CANCELADA e a PENDENTE)'
);
select is(
  (select count(*) from public.pagamento p join public.reserva r using (id_reserva)
   where r.id_carona = '20000000-0000-0000-0000-000000000001'),
  2::bigint,
  'passageiro lê os próprios pagamentos'
);
select is(
  (select count(*) from public.reserva
   where id_carona = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'passageiro não lê a reserva de outra pessoa'
);

select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);
select is(
  (select count(*) from public.reserva
   where id_carona in ('20000000-0000-0000-0000-000000000001',
                       '20000000-0000-0000-0000-000000000002')),
  3::bigint,
  'motorista lê as reservas das próprias caronas'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000002',
                                       'b0000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'anon não executa reservar_vaga'
);

-- ------------------------------------------------------------
-- Sem parâmetro de custo: erro de domínio, e nada muda (uma transação)
-- ------------------------------------------------------------

reset role;
delete from public.parametro_custo;
set local role service_role;
select throws_ok(
  $$select * from public.reservar_vaga('20000000-0000-0000-0000-000000000002',
                                       'c0000000-0000-0000-0000-00000000000c')$$,
  'PT500', 'PARAMETRO_AUSENTE', 'sem parametro_custo a reserva é recusada'
);
select results_eq(
  $$select vagas_disponiveis::int from public.carona
    where id_carona = '20000000-0000-0000-0000-000000000002'$$,
  $$values (1)$$,
  'a falha não baixou a vaga'
);
select is(
  (select count(*) from public.reserva
   where id_passageiro = 'c0000000-0000-0000-0000-00000000000c'),
  0::bigint,
  'a falha não deixou reserva'
);

select * from finish();
rollback;
