-- Dados de desenvolvimento (só local: roda no `supabase db reset`, nunca no remoto).
-- Usuários sem senha: o login de teste depende da configuração do Auth (T08/T09).
-- Até o trigger criar_perfil_usuario existir (T09), o perfil em public.usuario é inserido à mão.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'motorista.dev@rede.ulbra.br', '', now(),
    '{"provider": "email", "providers": ["email"]}', '{"nome_completo": "Marina Motorista"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'passageiro.dev@rede.ulbra.br', '', now(),
    '{"provider": "email", "providers": ["email"]}', '{"nome_completo": "Paulo Passageiro"}',
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

insert into public.usuario (
  id_usuario, id_instituicao, nome_completo, email_institucional, genero, telefone
)
select v.id_usuario, i.id_instituicao, v.nome_completo, v.email, v.genero::public.genero_usuario,
  v.telefone
from (
  values
    ('d0000000-0000-0000-0000-000000000001'::uuid, 'Marina Motorista',
     'motorista.dev@rede.ulbra.br', 'FEMININO', '51990000001'),
    ('d0000000-0000-0000-0000-000000000002'::uuid, 'Paulo Passageiro',
     'passageiro.dev@rede.ulbra.br', 'MASCULINO', null)
) as v (id_usuario, nome_completo, email, genero, telefone)
cross join public.instituicao i
where i.dominio_email = 'rede.ulbra.br'
on conflict (id_usuario) do nothing;

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
  destino_lng, data_hora_partida, vagas_disponiveis, custo_total, tolerancia_min, status
)
values (
  'd2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000001',
  'Centro, Torres - RS', -29.335300, -49.726800,
  'ULBRA Torres - RS', -29.329000, -49.736500,
  date_trunc('day', now() at time zone 'utc') at time zone 'utc' + interval '3 days 10 hours 30 minutes',
  3, 24.00, 10, 'ABERTA'
)
on conflict (id_carona) do nothing;
