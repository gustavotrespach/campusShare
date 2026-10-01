# SPEC.md — CampusShare (MVP)

## Objetivo

Permitir que alunos da mesma instituição ofereçam e encontrem caronas com segurança (acesso só por e-mail institucional verificado) e dividam o custo da viagem sem constrangimento, com rateio e pagamento dentro do app.

## Escopo

**Dentro do MVP (até a AP2, 22/10/2026):**
- Cadastro institucional, confirmação de e-mail e login
- Cadastro de veículos
- Publicação, busca, reserva e cancelamento de caronas
- Rateio automático e pagamento via Pix em **sandbox**
- Sugestão de preço pelo custo de combustível (Sprint 3)
- Notificações de reserva e cancelamento
- Avaliação mútua

**Fora do MVP:**
- Pix em produção (depende de CNPJ e conta empresarial)
- Publicação nas lojas (distribuição via EAS Build)
- Chat entre usuários, rastreamento em tempo real, outras instituições (o modelo já permite, mas só a ULBRA será cadastrada)

## Atores

- **Aluno** — qualquer usuário verificado. Atua como **motorista** (publica carona) ou **passageiro** (reserva vaga).
- **Equipe CampusShare** — mantém `PARAMETRO_CUSTO` (preço do litro e percentual da taxa).
- **Sistemas externos** — Supabase (Auth, banco, Edge Functions), Google Maps, Mercado Pago, Resend (SMTP do Auth), Expo Notifications.

## User Stories (backlog priorizado na AP1)

| ID | História | Critérios de aceite |
|---|---|---|
| US01 | Como aluno, quero fazer login na plataforma para acessar as caronas. | Login com e-mail institucional e senha retorna a sessão do Supabase Auth (JWT); e-mail não verificado é bloqueado com mensagem clara; credenciais inválidas retornam erro genérico. |
| US02 | Como aluno, quero me cadastrar com meu e-mail institucional para ter uma conta confiável. | Só aceita e-mails do `dominio_email` de uma INSTITUICAO cadastrada; e-mail duplicado é recusado; conta nasce com `email_verificado = false`; link de confirmação enviado por e-mail (Supabase Auth) ativa a conta. |
| US03 | Como motorista, quero informar o horário exato de partida para que os passageiros se organizem. | Carona exige data e hora de partida no futuro; horário aparece na listagem e no detalhe. |
| US04 | Como passageiro, quero que o valor da carona seja calculado automaticamente para evitar constrangimento. | Ao reservar, o backend calcula `valor_individual` (função SQL) e gera a cobrança (Edge Function); o passageiro vê o valor antes de confirmar. |
| US05 | Como aluna, quero filtrar caronas "somente mulheres" para me sentir mais segura. | Motorista pode marcar a carona como `somente_mulheres`; a busca oferece o filtro; a regra é validada no backend na reserva. |
| US06 | Como passageiro, quero ser notificado se a carona for cancelada. | Cancelamento pelo motorista gera NOTIFICACAO + push para todos os passageiros com reserva ativa; motorista recebe push quando uma vaga é reservada. |
| US07 | Como motorista, quero definir um tempo de tolerância para esperar os passageiros. | Carona tem `tolerancia_min` (0 a 30 min), exibida ao passageiro. |

## Regras de negócio

**Cadastro e acesso**
- RN01 — Só é aceito e-mail cujo domínio exista em `INSTITUICAO.dominio_email` (hoje: `rede.ulbra.br`). A regra lê o banco (Auth Hook); nada de domínio fixo no código.
- RN02 — Usuário sem e-mail confirmado (`auth.users.email_confirmed_at` nulo) não faz login nem usa o app.
- RN03 — Senha com no mínimo 8 caracteres; armazenamento (hash bcrypt) feito pelo Supabase Auth.

**Veículos e caronas**
- RN04 — Só publica carona quem tem ao menos um veículo cadastrado.
- RN05 — `vagas_disponiveis` na publicação ≤ `VEICULO.qtd_lugares − 1` (o motorista ocupa um lugar).
- RN06 — `data_hora_partida` deve estar no futuro.
- RN07 — Status da carona: `ABERTA` → `LOTADA` (vagas = 0) → `CONCLUIDA`; ou `CANCELADA` a qualquer momento antes da partida.
- RN08 — A carona some da busca quando está `LOTADA`, `CANCELADA`, `CONCLUIDA` ou com horário já passado.

**Preço e rateio**
- RN09 — Custo estimado: `custo_estimado = (distancia_km ÷ consumo_kml) × preco_litro`. Distância pela Directions API; consumo do VEICULO; preço do litro em `PARAMETRO_CUSTO`.
- RN10 — **Teto:** `custo_total` definido pelo motorista pode ser menor ou igual a `custo_estimado`, **nunca maior**. Mantém o produto como divisão de despesas, não transporte remunerado.
- RN11 — Rateio: `valor_individual = custo_total ÷ n_ocupantes`, calculado **no backend** (função SQL `reservar_vaga`) e gravado na RESERVA.
- RN12 — Precificação por etapas: na Sprint 2 o motorista digita `custo_total` (sem teto, pois ainda não há `custo_estimado`); o teto entra na Sprint 3 junto com a sugestão.
- RN13 — Taxa: `taxa_plataforma = valor × percentual_taxa`; `valor_repassado = valor − taxa_plataforma`. Ambos gravados em PAGAMENTO.

**Reserva e pagamento**
- RN14 — Motorista não reserva a própria carona; passageiro não reserva duas vezes a mesma carona.
- RN15 — Reserva nasce `PENDENTE` e ocupa a vaga temporariamente; passa a `CONFIRMADA` **somente** quando o webhook do Pix confirma o pagamento.
- RN16 — Reserva `PENDENTE` sem pagamento dentro do prazo de expiração vira `EXPIRADA` e a vaga é devolvida.
- RN17 — Reserva, cancelamento e expiração alteram `vagas_disponiveis` dentro de uma única função SQL (transação com `SELECT ... FOR UPDATE`), para impedir que duas reservas simultâneas ocupem a mesma vaga.
- RN18 — Carona `somente_mulheres` só aceita reserva de usuárias com `genero` feminino.

**Avaliação**
- RN19 — Avaliação só depois da carona `CONCLUIDA`, só entre participantes da mesma reserva, nota de 1 a 5, uma por avaliador por reserva.

## Requisitos não funcionais

- RNF01 — Android e iOS a partir de uma base de código.
- RNF02 — Custo zero de infraestrutura (free tiers).
- RNF03 — Toda comunicação via HTTPS.
- RNF04 — Regras de negócio críticas apenas no backend Supabase (funções SQL, RLS, constraints e Edge Functions) — nunca no app.
- RNF05 — Respostas do backend em até 2 s nas operações comuns (considerando o "cold start" das Edge Functions).
- RNF06 — Interface em português (pt-BR); valores em R$; horários em `America/Sao_Paulo`.

## Casos de borda

- Duas pessoas reservam a última vaga ao mesmo tempo → só uma consegue (transação); a outra recebe "carona lotada".
- Pagamento nunca confirmado → reserva expira e a vaga volta (RN16).
- Webhook chega duplicado → processamento idempotente, sem pagamento em dobro.
- Motorista cancela com reservas confirmadas → todos notificados; reembolso fica registrado como pendente (sandbox).
- Link de confirmação de e-mail expirado → usuário pode pedir reenvio (`auth.resend`).
- Aluno com e-mail de outro domínio → cadastro recusado com mensagem explicando o motivo.
- Directions API indisponível → motorista pode publicar informando o valor, sem sugestão (fallback da Sprint 2).
- Carona com horário passado e ainda `ABERTA` → não aparece na busca e não aceita reservas.

## Rastreabilidade

| US | Módulo | Onde no backend (Supabase) | Entidades |
|---|---|---|---|
| US01 | auth | Supabase Auth | USUARIO |
| US02 | auth + e-mail | Supabase Auth + hook `validar_dominio_institucional` + trigger `criar_perfil_usuario` | USUARIO, INSTITUICAO |
| US03 | caronas | RPC `publicar_carona` | CARONA, VEICULO |
| US04 | reservas + pagamentos | Edge Function `reservar-vaga` + RPC `reservar_vaga` + webhook | CARONA, RESERVA, PAGAMENTO |
| US05 | caronas | RPC `buscar_caronas` | CARONA, USUARIO |
| US06 | notificacoes | Triggers + Database Webhook + Edge Function `enviar-push` | NOTIFICACAO, RESERVA |
| US07 | caronas | RPC `publicar_carona` | CARONA |
