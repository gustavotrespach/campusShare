-- T17 — publicar_carona: caminho feliz, RN04 a RN06, faixas de US03/US07 com códigos do domínio
-- (nunca 23xxx), somente_mulheres, acesso (anon, INSERT direto) e configuração de segurança.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- ------------------------------------------------------------
-- Dados de teste (como postgres)
-- A = a0...0a (veículo a1...01 com 5 lugares) · B = b0...0b (veículo b1...01) · C = c0...0c (sem veículo)
-- ------------------------------------------------------------

insert into public.instituicao (nome, dominio_email) values ('Instituição de Teste', 'teste.edu.br');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-00000000000a', 'motorista.a@teste.edu.br',
   '{"nome_completo": "Motorista A"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'motorista.b@teste.edu.br',
   '{"nome_completo": "Motorista B"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'sem.veiculo@teste.edu.br',
   '{"nome_completo": "Sem Veículo C"}');

insert into public.veiculo (id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'Onix', 'AAA1A11', 'Prata', 5),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b',
   'Gol', 'BBB1B11', 'Branco', 5);

-- Chamada com valores válidos por padrão; cada teste troca só o que interessa. SECURITY INVOKER:
-- quem chama publicar_carona é o papel do teste, com o JWT simulado.
create function public.teste_publicar(
  p_id_veiculo uuid default 'a1000000-0000-0000-0000-000000000001',
  p_origem text default 'Centro, Torres',
  p_origem_lat numeric default -29.335,
  p_origem_lng numeric default -49.727,
  p_destino text default 'ULBRA Torres',
  p_destino_lat numeric default -29.330,
  p_destino_lng numeric default -49.740,
  p_data_hora_partida timestamptz default now() + interval '1 day',
  p_vagas_ofertadas int default 3,
  p_custo_total numeric default 24.00,
  p_tolerancia_min int default 10,
  p_somente_mulheres boolean default false
) returns uuid
language sql
as $$
  select public.publicar_carona(
    p_id_veiculo, p_origem, p_origem_lat, p_origem_lng, p_destino, p_destino_lat, p_destino_lng,
    p_data_hora_partida, p_vagas_ofertadas, p_custo_total, p_tolerancia_min, p_somente_mulheres
  );
$$;
grant execute on function public.teste_publicar to authenticated, anon;

-- Devolve "message | hint" do erro, para conferir a frase que o app mostra
create function pg_temp.erro_ao_publicar(p_vagas int)
returns text
language plpgsql
as $$
declare
  v_mensagem text;
  v_hint text;
begin
  perform public.teste_publicar(p_vagas_ofertadas => p_vagas);
  return 'sem erro';
exception when others then
  get stacked diagnostics v_mensagem = message_text, v_hint = pg_exception_hint;
  return v_mensagem || ' | ' || v_hint;
end;
$$;

-- ------------------------------------------------------------
-- Configuração de segurança
-- ------------------------------------------------------------

select has_function(
  'public', 'publicar_carona',
  array['uuid', 'text', 'numeric', 'numeric', 'text', 'numeric', 'numeric',
        'timestamp with time zone', 'integer', 'numeric', 'integer', 'boolean'],
  'publicar_carona existe com a assinatura esperada'
);
select is_definer('public', 'publicar_carona', 'publicar_carona é SECURITY DEFINER');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.publicar_carona'::regproc),
  'publicar_carona fixa search_path vazio'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.publicar_carona(uuid, text, numeric, numeric, text, numeric, numeric, timestamptz, int, numeric, int, boolean)',
    'execute'
  ),
  'anon não tem EXECUTE em publicar_carona'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.publicar_carona(uuid, text, numeric, numeric, text, numeric, numeric, timestamptz, int, numeric, int, boolean)',
    'execute'
  ),
  'authenticated tem EXECUTE em publicar_carona'
);

-- ------------------------------------------------------------
-- Como o motorista A (authenticated)
-- ------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

-- Caminho feliz
select isnt(
  public.teste_publicar(p_origem => '  Centro, Torres  ', p_destino => ' ULBRA Torres '),
  null,
  'publicar_carona devolve o id da carona'
);
select results_eq(
  $$select status::text, id_motorista, vagas_ofertadas::int, vagas_disponiveis::int,
      custo_estimado is null, distancia_km is null, origem::text, destino::text,
      custo_total, tolerancia_min::int, somente_mulheres
    from public.carona$$,
  $$values ('ABERTA', 'a0000000-0000-0000-0000-00000000000a'::uuid, 3, 3, true, true,
      'Centro, Torres', 'ULBRA Torres', 24.00::numeric, 10, false)$$,
  'carona ABERTA do usuário da sessão, vagas_ofertadas = vagas_disponiveis, sem custo_estimado '
    || 'e distancia_km, textos com trim; o motorista a lê pela RLS'
);

-- RN05: veículo de 5 lugares oferece até 4 vagas
select lives_ok(
  $$select public.teste_publicar(p_vagas_ofertadas => 4)$$,
  '4 vagas num veículo de 5 lugares é aceito'
);
select throws_ok(
  $$select public.teste_publicar(p_vagas_ofertadas => 5)$$,
  'PT422', 'VAGAS_ACIMA_DO_LIMITE', '5 vagas num veículo de 5 lugares é recusado (RN05)'
);
select throws_ok(
  $$select public.teste_publicar(p_vagas_ofertadas => 0)$$,
  'PT400', 'DADOS_INVALIDOS', '0 vagas é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_vagas_ofertadas => 40000)$$,
  'PT422', 'VAGAS_ACIMA_DO_LIMITE', 'número de vagas enorme chega à validação (sem erro técnico)'
);

-- Veículo
select throws_ok(
  $$select public.teste_publicar(p_id_veiculo => 'b1000000-0000-0000-0000-000000000001')$$,
  'PT404', 'VEICULO_NAO_ENCONTRADO', 'veículo de outro motorista é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_id_veiculo => 'f1000000-0000-0000-0000-000000000009')$$,
  'PT404', 'VEICULO_NAO_ENCONTRADO', 'veículo inexistente tem a mesma resposta'
);

-- RN06
select throws_ok(
  $$select public.teste_publicar(p_data_hora_partida => now() - interval '1 minute')$$,
  'PT400', 'PARTIDA_NO_PASSADO', 'partida no passado é recusada (RN06)'
);
select throws_ok(
  $$select public.teste_publicar(p_data_hora_partida => now())$$,
  'PT400', 'PARTIDA_NO_PASSADO', 'partida agora também é recusada'
);
select throws_ok(
  $$select public.teste_publicar(p_data_hora_partida => null)$$,
  'PT400', 'DADOS_INVALIDOS', 'partida ausente é recusada'
);

-- Faixas: DADOS_INVALIDOS em vez de 23514
select throws_ok(
  $$select public.teste_publicar(p_origem => '   ')$$,
  'PT400', 'DADOS_INVALIDOS', 'origem vazia é recusada'
);
select throws_ok(
  $$select public.teste_publicar(p_destino => repeat('x', 201))$$,
  'PT400', 'DADOS_INVALIDOS', 'destino com 201 caracteres é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_origem_lat => 91)$$,
  'PT400', 'DADOS_INVALIDOS', 'latitude de origem fora da faixa é recusada'
);
select throws_ok(
  $$select public.teste_publicar(p_destino_lng => -181)$$,
  'PT400', 'DADOS_INVALIDOS', 'longitude de destino fora da faixa é recusada'
);
select throws_ok(
  $$select public.teste_publicar(p_custo_total => 0)$$,
  'PT400', 'DADOS_INVALIDOS', 'custo_total = 0 é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_custo_total => -5)$$,
  'PT400', 'DADOS_INVALIDOS', 'custo_total negativo é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_custo_total => 10.005)$$,
  'PT400', 'DADOS_INVALIDOS', 'custo_total com 3 casas decimais é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_custo_total => 100000000)$$,
  'PT400', 'DADOS_INVALIDOS', 'custo_total acima do limite da coluna é recusado'
);
select throws_ok(
  $$select public.teste_publicar(p_tolerancia_min => 31)$$,
  'PT400', 'DADOS_INVALIDOS', 'tolerância de 31 minutos é recusada (US07)'
);
select throws_ok(
  $$select public.teste_publicar(p_tolerancia_min => -1)$$,
  'PT400', 'DADOS_INVALIDOS', 'tolerância negativa é recusada'
);
select lives_ok(
  $$select public.teste_publicar(p_tolerancia_min => 30, p_custo_total => 0.01)$$,
  'tolerância de 30 minutos e custo de 1 centavo são aceitos (limites)'
);

-- somente_mulheres: gravado, sem restrição para quem publica (RN18 é na reserva)
select lives_ok(
  $$select public.teste_publicar(p_origem => 'Rota só mulheres', p_somente_mulheres => true)$$,
  'carona somente_mulheres é publicada'
);
select is(
  (select somente_mulheres from public.carona where origem = 'Rota só mulheres'),
  true,
  'somente_mulheres = true é gravado'
);

-- Escrita direta continua bloqueada
select throws_ok(
  $$insert into public.carona (
      id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
      destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total,
      tolerancia_min)
    values ('a0000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
      'Centro', -29.335, -49.727, 'ULBRA', -29.330, -49.740, now() + interval '1 day', 3, 3, 40,
      10)$$,
  '42501', null, 'INSERT direto em carona como authenticated é recusado'
);

-- Sessão sem usuário (JWT sem sub)
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.teste_publicar()$$,
  'PT401', 'NAO_AUTENTICADO', 'sem auth.uid() é recusado'
);

-- ------------------------------------------------------------
-- Como C, sem veículo (RN04)
-- ------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub": "c0000000-0000-0000-0000-00000000000c", "role": "authenticated"}',
  true
);
select throws_ok(
  $$select public.teste_publicar(p_id_veiculo => 'b1000000-0000-0000-0000-000000000001')$$,
  'PT422', 'SEM_VEICULO', 'usuário sem veículo não publica (RN04), mesmo citando um veículo alheio'
);

-- ------------------------------------------------------------
-- Como anon
-- ------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select public.teste_publicar()$$,
  '42501', null, 'anon não executa publicar_carona'
);

-- ------------------------------------------------------------
-- Mensagens e efeitos (como postgres, com o JWT de A para auth.uid())
-- ------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub": "a0000000-0000-0000-0000-00000000000a", "role": "authenticated"}',
  true
);

select is(
  pg_temp.erro_ao_publicar(5),
  'VAGAS_ACIMA_DO_LIMITE | Este veículo comporta no máximo 4 vagas para passageiros.',
  'VAGAS_ACIMA_DO_LIMITE informa o limite do veículo no hint'
);
select is(
  pg_temp.erro_ao_publicar(0),
  'DADOS_INVALIDOS | Ofereça pelo menos 1 vaga.',
  'DADOS_INVALIDOS traz uma frase específica do campo'
);
select is(
  (select count(*) from public.carona
   where id_motorista = 'a0000000-0000-0000-0000-00000000000a'),
  4::bigint,
  'só as publicações válidas gravaram carona (feliz, 4 vagas, limites, só mulheres)'
);
select is(
  (select count(*) from public.carona
   where id_motorista = 'a0000000-0000-0000-0000-00000000000a'
     and vagas_ofertadas <> vagas_disponiveis),
  0::bigint,
  'toda carona publicada nasce com vagas_ofertadas = vagas_disponiveis'
);

select * from finish();
rollback;
