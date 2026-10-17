-- Dados de desenvolvimento (só local: roda no `supabase db reset`, nunca no remoto).
-- Usuários sem senha (não fazem login); para testar login, cadastre pelo /auth/v1/signup.
-- O perfil em public.usuario é criado pelo trigger criar_perfil_usuario a partir de
-- raw_user_meta_data, como num cadastro real.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'motorista.dev@rede.ulbra.br', '', now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"nome_completo": "Marina Motorista", "genero": "FEMININO", "telefone": "51990000001"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'passageiro.dev@rede.ulbra.br', '', now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"nome_completo": "Paulo Passageiro", "genero": "MASCULINO"}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into public.veiculo (
  id_veiculo, id_motorista, modelo, placa, cor, qtd_lugares, motorizacao, consumo_kml
)
values (
  'd1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
  'Chevrolet Onix', 'RST2E34', 'Prata', 5, '1.0', 13.5
)
on conflict (id_veiculo) do nothing;

-- Partida daqui a 3 dias às 07:30 de Brasília (10:30 UTC)
insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min,
  status
)
values (
  'd2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'Centro, Torres - RS', -29.335300, -49.726800,
  'ULBRA Torres - RS', -29.329000, -49.736500,
  date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '3 days 10 hours 30 minutes',
  3, 3, 24.00, 10, 'ABERTA'
)
on conflict (id_carona) do nothing;

-- Caronas variadas para testar a busca (T18/T19), todas da motorista do seed (Onix, 5 lugares).
-- Horários de Brasília (UTC−3) a partir da meia-noite UTC de hoje, sempre no futuro.
insert into public.carona (
  id_carona, id_motorista, id_veiculo, origem, origem_lat, origem_lng, destino, destino_lat,
  destino_lng, data_hora_partida, vagas_ofertadas, vagas_disponiveis, custo_total, tolerancia_min,
  somente_mulheres, status
)
values
  -- Somente mulheres, perto de Torres: depois de amanhã às 18:00
  (
    'd2000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Praia Grande, Torres - RS', -29.341800, -49.726200,
    'ULBRA Torres - RS', -29.329000, -49.736500,
    date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '2 days 21 hours',
    2, 2, 18.00, 5, true, 'ABERTA'
  ),
  -- Outro horário perto de Torres: amanhã às 12:30
  (
    'd2000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Rodoviária de Torres - RS', -29.338500, -49.735500,
    'ULBRA Torres - RS', -29.329000, -49.736500,
    date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '1 day 15 hours 30 minutes',
    4, 4, 25.00, 15, false, 'ABERTA'
  ),
  -- Longe: Porto Alegre, fora do raio padrão de 10 km a partir de Torres
  (
    'd2000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Centro Histórico, Porto Alegre - RS', -30.027700, -51.228700,
    'ULBRA Torres - RS', -29.329000, -49.736500,
    date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '4 days 9 hours',
    3, 3, 120.00, 10, false, 'ABERTA'
  ),
  -- LOTADA (0 de 3 vagas): não aparece na busca
  (
    'd2000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    'Centro, Torres - RS', -29.335300, -49.726800,
    'ULBRA Torres - RS', -29.329000, -49.736500,
    date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '2 days 10 hours 30 minutes',
    3, 0, 24.00, 10, false, 'LOTADA'
  )
on conflict (id_carona) do nothing;
