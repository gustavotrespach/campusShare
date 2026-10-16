-- T06 — Schema inicial: INSTITUICAO, USUARIO, VEICULO e CARONA, com RLS, políticas e grants.
-- Fonte: docs/DATABASE.md. Tabelas com regra de negócio (carona) não aceitam escrita direta do app.

-- ============================================================
-- Enums
-- ============================================================

create type public.genero_usuario as enum ('FEMININO', 'MASCULINO', 'OUTRO', 'NAO_INFORMADO');

create type public.status_carona as enum ('ABERTA', 'LOTADA', 'CANCELADA', 'CONCLUIDA');

-- ============================================================
-- INSTITUICAO
-- ============================================================

create table public.instituicao (
  id_instituicao int generated always as identity primary key,
  nome varchar(120) not null,
  dominio_email varchar(80) not null,
  constraint instituicao_dominio_email_key unique (dominio_email),
  -- RN01 compara o domínio exato após o '@', em minúsculas
  constraint instituicao_dominio_email_formato check (
    dominio_email = lower(dominio_email) and position('@' in dominio_email) = 0
  )
);

-- ============================================================
-- USUARIO (perfil 1:1 com auth.users; senha e confirmação ficam no Supabase Auth — ADR-009)
-- ============================================================

create table public.usuario (
  id_usuario uuid primary key references auth.users (id) on delete cascade,
  id_instituicao int not null references public.instituicao (id_instituicao),
  nome_completo varchar(120) not null,
  email_institucional varchar(160) not null,
  genero public.genero_usuario not null default 'NAO_INFORMADO',
  telefone varchar(20),
  expo_push_token varchar(100),
  criado_em timestamptz not null default now(),
  constraint usuario_email_institucional_key unique (email_institucional),
  constraint usuario_email_institucional_minusculo check (
    email_institucional = lower(email_institucional)
  )
);

create index usuario_id_instituicao_idx on public.usuario (id_instituicao);

-- ============================================================
-- VEICULO
-- ============================================================

create table public.veiculo (
  id_veiculo uuid primary key default gen_random_uuid(),
  id_motorista uuid not null default auth.uid()
    references public.usuario (id_usuario) on delete cascade,
  modelo varchar(60) not null,
  placa varchar(8) not null,
  cor varchar(30) not null,
  qtd_lugares smallint not null,
  motorizacao varchar(10),
  consumo_kml decimal(4, 1),
  constraint veiculo_placa_key unique (placa),
  -- Maiúsculas e sem hífen: antiga (ABC1234) ou Mercosul (ABC1D23); evita duplicar a mesma placa
  constraint veiculo_placa_formato check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  constraint veiculo_qtd_lugares_faixa check (qtd_lugares between 2 and 8),
  constraint veiculo_consumo_kml_positivo check (consumo_kml > 0),
  -- Alvo da FK composta de carona: garante que o veículo da carona é do próprio motorista
  constraint veiculo_id_veiculo_id_motorista_key unique (id_veiculo, id_motorista)
);

create index veiculo_id_motorista_idx on public.veiculo (id_motorista);

-- ============================================================
-- CARONA
-- ============================================================

create table public.carona (
  id_carona uuid primary key default gen_random_uuid(),
  id_motorista uuid not null references public.usuario (id_usuario) on delete cascade,
  id_veiculo uuid not null,
  origem varchar(200) not null,
  origem_lat decimal(9, 6) not null,
  origem_lng decimal(9, 6) not null,
  destino varchar(200) not null,
  destino_lat decimal(9, 6) not null,
  destino_lng decimal(9, 6) not null,
  distancia_km decimal(6, 2),
  data_hora_partida timestamptz not null,
  vagas_disponiveis smallint not null,
  custo_estimado decimal(10, 2),
  custo_total decimal(10, 2) not null,
  tolerancia_min smallint not null,
  somente_mulheres boolean not null default false,
  status public.status_carona not null default 'ABERTA',
  constraint carona_veiculo_do_motorista_fkey foreign key (id_veiculo, id_motorista)
    references public.veiculo (id_veiculo, id_motorista),
  constraint carona_origem_coordenadas check (
    origem_lat between -90 and 90 and origem_lng between -180 and 180
  ),
  constraint carona_destino_coordenadas check (
    destino_lat between -90 and 90 and destino_lng between -180 and 180
  ),
  constraint carona_distancia_km_positiva check (distancia_km > 0),
  -- Limite absoluto (veículo tem no máximo 8 lugares, 1 é do motorista);
  -- o limite pelo veículo (RN05) e a data no futuro (RN06) ficam em publicar_carona
  constraint carona_vagas_disponiveis_faixa check (vagas_disponiveis between 0 and 7),
  constraint carona_custo_estimado_positivo check (custo_estimado > 0),
  constraint carona_custo_total_positivo check (custo_total > 0),
  -- Teto de preço (RN10, ADR-007)
  constraint carona_custo_total_teto check (
    custo_estimado is null or custo_total <= custo_estimado
  ),
  constraint carona_tolerancia_min_faixa check (tolerancia_min between 0 and 30)
);

create index carona_status_data_hora_partida_idx on public.carona (status, data_hora_partida);
create index carona_origem_lat_origem_lng_idx on public.carona (origem_lat, origem_lng);
create index carona_id_motorista_idx on public.carona (id_motorista);
create index carona_id_veiculo_id_motorista_idx on public.carona (id_veiculo, id_motorista);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.instituicao enable row level security;
alter table public.usuario enable row level security;
alter table public.veiculo enable row level security;
alter table public.carona enable row level security;

create policy "autenticados leem as instituições"
  on public.instituicao for select
  to authenticated
  using (true);

create policy "usuário lê o próprio perfil"
  on public.usuario for select
  to authenticated
  using (id_usuario = (select auth.uid()));

create policy "usuário atualiza o próprio perfil"
  on public.usuario for update
  to authenticated
  using (id_usuario = (select auth.uid()))
  with check (id_usuario = (select auth.uid()));

create policy "motorista lê os próprios veículos"
  on public.veiculo for select
  to authenticated
  using (id_motorista = (select auth.uid()));

create policy "motorista cadastra os próprios veículos"
  on public.veiculo for insert
  to authenticated
  with check (id_motorista = (select auth.uid()));

create policy "motorista atualiza os próprios veículos"
  on public.veiculo for update
  to authenticated
  using (id_motorista = (select auth.uid()))
  with check (id_motorista = (select auth.uid()));

create policy "motorista exclui os próprios veículos"
  on public.veiculo for delete
  to authenticated
  using (id_motorista = (select auth.uid()));

-- Busca e detalhe de caronas de outros motoristas serão feitos por funções (buscar_caronas, detalhar_carona)
create policy "motorista lê as próprias caronas"
  on public.carona for select
  to authenticated
  using (id_motorista = (select auth.uid()));

-- ============================================================
-- Grants
-- O remoto não expõe tabelas novas automaticamente, e o local concede tudo por padrão:
-- revoga tudo e concede explicitamente o mínimo, para os dois ambientes ficarem iguais.
-- ============================================================

revoke all on public.instituicao, public.usuario, public.veiculo, public.carona
  from public, anon, authenticated;

grant select on public.instituicao to authenticated;

-- email_institucional e id_instituicao vêm do cadastro (Auth) e não são editáveis pelo app
grant select on public.usuario to authenticated;
grant update (nome_completo, telefone, genero, expo_push_token) on public.usuario to authenticated;

grant select, insert, update, delete on public.veiculo to authenticated;

-- Escrita em carona só por funções SQL (publicar_carona, cancelar_carona, concluir_carona)
grant select on public.carona to authenticated;

-- Edge Functions (service_role) ignoram a RLS, mas ainda precisam de privilégio na tabela
grant all on public.instituicao, public.usuario, public.veiculo, public.carona to service_role;
