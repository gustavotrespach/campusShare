-- T20 — Modelo de dados da reserva e do pagamento: RESERVA, PAGAMENTO e PARAMETRO_CUSTO, com RLS
-- só de leitura para os participantes, e CARONA.vagas_ofertadas (RN11).
-- Fonte: docs/DATABASE.md. Escrita nas três tabelas só por funções SQL e Edge Functions (T21–T23).

-- ============================================================
-- Enums
-- ============================================================

create type public.status_reserva as enum ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA');

create type public.status_pagamento as enum (
  'PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSO_PENDENTE'
);

create type public.metodo_pagamento as enum ('PIX');

-- ============================================================
-- CARONA.vagas_ofertadas
-- RN11: n_ocupantes = vagas_ofertadas + 1, fixado na publicação; vagas_disponiveis diminui a cada
-- reserva e não serve para o rateio. publicar_carona (T17) grava as duas com o mesmo valor.
-- ============================================================

alter table public.carona add column vagas_ofertadas smallint;

-- Caronas já existentes (seed local; o remoto não tem caronas, porque o app não as cria ainda):
-- sem reservas até aqui, as vagas disponíveis são as ofertadas. greatest(..., 1) só existe para
-- uma carona LOTADA criada à mão não impedir a migration de aplicar o CHECK abaixo.
update public.carona set vagas_ofertadas = greatest(vagas_disponiveis, 1);

alter table public.carona
  alter column vagas_ofertadas set not null,
  -- Mesmo limite absoluto de vagas_disponiveis (8 lugares, 1 é do motorista), mas sem o 0:
  -- carona sem vaga ofertada não existe
  add constraint carona_vagas_ofertadas_faixa check (vagas_ofertadas between 1 and 7),
  add constraint carona_vagas_disponiveis_ate_ofertadas check (
    vagas_disponiveis <= vagas_ofertadas
  );

-- ============================================================
-- RESERVA (associativa USUARIO N:N CARONA)
-- ============================================================

create table public.reserva (
  id_reserva uuid primary key default gen_random_uuid(),
  -- Cascata nas duas FKs: a exclusão da conta (passageiro ou motorista) leva as reservas junto
  id_carona uuid not null references public.carona (id_carona) on delete cascade,
  id_passageiro uuid not null references public.usuario (id_usuario) on delete cascade,
  -- Rateio (RN11) calculado em reservar_vaga (T21) e gravado aqui, para não mudar depois
  valor_individual decimal(10, 2) not null,
  status public.status_reserva not null default 'PENDENTE',
  -- Base do prazo de expiração da reserva PENDENTE (RN16)
  criado_em timestamptz not null default now(),
  constraint reserva_valor_individual_positivo check (valor_individual > 0)
);

-- RN14: uma reserva ativa por passageiro por carona; depois de CANCELADA ou EXPIRADA pode reservar de novo
create unique index reserva_id_carona_id_passageiro_ativa_key
  on public.reserva (id_carona, id_passageiro)
  where status in ('PENDENTE', 'CONFIRMADA');

create index reserva_id_carona_idx on public.reserva (id_carona);
create index reserva_id_passageiro_idx on public.reserva (id_passageiro);

-- ============================================================
-- PAGAMENTO (1:1 com RESERVA)
-- ============================================================

create table public.pagamento (
  id_pagamento uuid primary key default gen_random_uuid(),
  id_reserva uuid not null references public.reserva (id_reserva) on delete cascade,
  -- Id da cobrança no Mercado Pago; nulo até a cobrança existir (T22). UNIQUE dá a idempotência
  -- do webhook (T23): a mesma notificação não gera dois pagamentos
  id_externo varchar(64),
  valor decimal(10, 2) not null,
  taxa_plataforma decimal(10, 2) not null,
  valor_repassado decimal(10, 2) not null,
  metodo public.metodo_pagamento not null default 'PIX',
  status public.status_pagamento not null default 'PENDENTE',
  -- Preenchido pelo webhook quando o Pix é aprovado
  pago_em timestamptz,
  constraint pagamento_id_reserva_key unique (id_reserva),
  constraint pagamento_id_externo_key unique (id_externo),
  constraint pagamento_valor_positivo check (valor > 0),
  constraint pagamento_taxa_plataforma_nao_negativa check (taxa_plataforma >= 0),
  constraint pagamento_taxa_plataforma_ate_valor check (taxa_plataforma <= valor),
  -- RN13: o repasse ao motorista é sempre o valor menos a taxa
  constraint pagamento_valor_repassado_calculo check (valor_repassado = valor - taxa_plataforma),
  constraint pagamento_aprovado_com_data check (status <> 'APROVADO' or pago_em is not null)
);

-- ============================================================
-- PARAMETRO_CUSTO (o registro mais recente é o vigente)
-- ============================================================

create table public.parametro_custo (
  id_parametro int generated always as identity primary key,
  preco_litro decimal(5, 2) not null,
  -- Fração: 0.1000 = 10% (RN13)
  percentual_taxa decimal(5, 4) not null,
  atualizado_em timestamptz not null default now(),
  constraint parametro_custo_preco_litro_positivo check (preco_litro > 0),
  constraint parametro_custo_percentual_taxa_faixa check (percentual_taxa between 0 and 1)
);

-- Dado essencial (decisão do Gustavo, 02/10): precisa existir também no remoto, por isso fica na
-- migration. Sem chave natural para on conflict; só insere se a tabela estiver vazia.
insert into public.parametro_custo (preco_litro, percentual_taxa)
select 6.29, 0.1000
where not exists (select 1 from public.parametro_custo);

-- ============================================================
-- Row Level Security (só SELECT; nenhuma escrita pelo app)
-- ============================================================

alter table public.reserva enable row level security;
alter table public.pagamento enable row level security;
alter table public.parametro_custo enable row level security;

create policy "passageiro lê as próprias reservas"
  on public.reserva for select
  to authenticated
  using (id_passageiro = (select auth.uid()));

create policy "motorista lê as reservas das próprias caronas"
  on public.reserva for select
  to authenticated
  using (
    exists (
      select 1
      from public.carona c
      where c.id_carona = reserva.id_carona
        and c.id_motorista = (select auth.uid())
    )
  );

create policy "passageiro lê o pagamento das próprias reservas"
  on public.pagamento for select
  to authenticated
  using (
    exists (
      select 1
      from public.reserva r
      where r.id_reserva = pagamento.id_reserva
        and r.id_passageiro = (select auth.uid())
    )
  );

-- parametro_custo: sem política. Só funções SQL e Edge Functions leem (preço e taxa).

-- ============================================================
-- Grants (mesmo padrão do schema_inicial: revoga tudo e concede o mínimo)
-- ============================================================

revoke all on public.reserva, public.pagamento, public.parametro_custo
  from public, anon, authenticated;

-- Escrita só por reservar_vaga, cancelar_reserva, registrar_pagamento e o webhook (T21–T23)
grant select on public.reserva, public.pagamento to authenticated;

grant all on public.reserva, public.pagamento, public.parametro_custo to service_role;
