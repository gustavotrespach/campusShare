# SECURITY.md — Segurança

> A segurança é parte da proposta de valor do CampusShare. Estas regras valem para código escrito por pessoas e por IA.
> Backend: Supabase (Auth + PostgreSQL com RLS + funções SQL + Edge Functions) — ver ADR-009.

## Autenticação (Supabase Auth)

- **Cadastro:** o domínio do e-mail é validado contra `INSTITUICAO.dominio_email` pelo Auth Hook **Before User Created** (função SQL `validar_dominio_institucional`), antes de o usuário existir. Comparação em minúsculas, pelo domínio exato após o `@` (`aluno@rede.ulbra.br.fake.com` é recusado).
- **Confirmação de e-mail:** obrigatória ("Confirm email" ligado). O link é gerado e validado pelo Supabase Auth e enviado pelo SMTP do Resend. Validade do link configurada no Auth (24 h).
- **Senha:** mínimo 8 caracteres, configurado no Auth. O hash (bcrypt) fica em `auth.users` — o projeto nunca armazena, loga ou retorna senha.
- **Sessão:** JWT do Supabase (`sub = id_usuario`), access token de 1 h renovado pelo refresh token. No app, a sessão é persistida com adapter seguro baseado em `expo-secure-store` — nunca em AsyncStorage sem criptografia.
- **Login:** mensagem genérica para e-mail ou senha errados (`invalid_credentials`). Usuário não confirmado é bloqueado pelo Auth (`email_not_confirmed`) e o app mostra mensagem clara.
- **Rate limit:** limites nativos do Supabase Auth para cadastro, login e reenvio de e-mail (revisar em Authentication → Rate Limits).

## Autorização

- **RLS habilitada em todas as tabelas** do schema `public`, sem exceção. Tabela sem política = ninguém acessa pelo app.
- Políticas por dono: só o motorista vê/edita os próprios veículos e caronas e vê os passageiros; o passageiro vê as próprias reservas e pagamentos; cada um vê só as próprias notificações e o próprio perfil completo.
- Tabelas com regra de negócio (`carona`, `reserva`, `pagamento`, `avaliacao`) **não aceitam INSERT/UPDATE direto** do app — só via funções SQL.
- O usuário vem **sempre** de `auth.uid()` (SQL) ou do JWT validado com `supabase.auth.getUser()` (Edge Function) — nunca de parâmetro do app.
- Funções `SECURITY DEFINER`: `set search_path = ''`, nomes qualificados (`public.carona`), `revoke execute ... from public, anon` e `grant` só para `authenticated` ou `service_role`, conforme o caso.
- A chave **`service_role`** ignora a RLS: existe só dentro das Edge Functions (variável injetada pelo Supabase). Nunca no app, no repositório ou em log.
- `PARAMETRO_CUSTO` não tem política de leitura para o app; só funções SQL e Edge Functions a usam.

## Regras de negócio protegidas no backend

O app pode ser modificado; por isso o backend recalcula e valida tudo:

| Regra | Onde |
|---|---|
| Domínio institucional | Auth Hook (SQL) |
| Rateio (`valor_individual`) — qualquer valor enviado pelo app é ignorado | Função `reservar_vaga` |
| Teto de preço (`custo_total ≤ custo_estimado`) | Edge Function `publicar-carona` + função SQL |
| Taxa e repasse | Função `registrar_pagamento` |
| Filtro "somente mulheres" na reserva | Função `reservar_vaga` |
| Vagas disponíveis | Função SQL, transação única + `SELECT ... FOR UPDATE` |
| Formatos e limites (placa, lugares, nota, tolerância) | `CHECK` constraints |

## Pagamentos

- Webhook do Mercado Pago na Edge Function `webhook-mercado-pago` com `verify_jwt = false` (o MP não envia JWT): validar a **assinatura** (`MP_WEBHOOK_SECRET`) e consultar o status da cobrança na API do Mercado Pago antes de confirmar — nunca confiar só no corpo recebido.
- **Idempotência:** o mesmo evento processado duas vezes não confirma nem repassa em dobro (`PAGAMENTO.id_externo` UNIQUE; `confirmar_pagamento` ignora pagamento já `APROVADO`).
- No MVP, somente credenciais de **sandbox**.

## Segredos

- Edge Functions: local em `supabase/functions/.env` (no `.gitignore`); remoto com `supabase secrets set`. `.env.example` versionado sem valores.
- SMTP do Resend: configurado no painel do Supabase Auth (e em `config.toml` via `env(...)` para o ambiente local).
- No app, só valores com prefixo `EXPO_PUBLIC_`: a URL do projeto e a **anon/publishable key** (pública por natureza — a proteção é a RLS) e a chave do Maps restrita por pacote/bundle no Google Cloud.
- Chave vazada: revogar/rotacionar imediatamente e registrar no MEMORY.md.

## Validação de entrada

- Edge Functions: todo body e query validados com **Zod** antes de qualquer chamada ao banco.
- Funções SQL: validam os próprios parâmetros (a RPC pode ser chamada direto, sem passar pelo app).
- Tamanhos e formatos garantidos por tipos e `CHECK` constraints (ver `DATABASE.md`).
- SQL dinâmico é proibido com dados do usuário; se inevitável, só com `format()` e `%L`/`%I`.

## Proteções do backend

- Expor pela API de dados só o schema `public`; GraphQL (`pg_graphql`) desativado.
- Edge Functions: CORS restrito às origens necessárias; `verify_jwt = true` em todas, exceto `health` e `webhook-mercado-pago`.
- Erros 500 com mensagem genérica; detalhes só nos logs do Supabase.
- HTTPS obrigatório (fornecido pelo Supabase).
- Rodar o **Security Advisor** do Supabase (painel → Advisors) antes de cada merge na `main`.

## Dados pessoais (LGPD)

- Coletar só o necessário: nome, e-mail institucional, gênero (para o filtro de segurança) e telefone opcional.
- Telefone e e-mail do motorista não aparecem para quem não tem reserva confirmada (RLS / funções de detalhe).
- `genero` é usado exclusivamente para a regra "somente mulheres"; não é exibido publicamente (fora da view `perfil_publico`).
- Não registrar dados pessoais, tokens ou senhas em logs das Edge Functions.
- Usuário pode solicitar exclusão da conta (fora do MVP, mas previsto: excluir em `auth.users` apaga o perfil em cascata).
