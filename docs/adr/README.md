# ADRs — Registro de Decisões de Arquitetura

Cada ADR explica o **porquê** de uma escolha técnica. Numeração incremental; nunca apagar um ADR — se a decisão mudar, criar um novo com status "Substitui ADR-00X".

| ADR | Decisão | Status |
|---|---|---|
| [001](ADR-001-react-native-expo.md) | React Native + Expo no app | Aceito |
| [002](ADR-002-node-express-typescript.md) | Node.js + Express com TypeScript na API | Substituído por 009 |
| [003](ADR-003-postgresql-supabase-prisma.md) | PostgreSQL no Supabase com Prisma | Aceito em parte (Prisma substituído por 009) |
| [004](ADR-004-monolito-modular-rest.md) | Monólito modular exposto como API REST | Substituído por 009 |
| [005](ADR-005-regras-de-negocio-no-servidor.md) | Regras de negócio só no servidor | Aceito |
| [006](ADR-006-pix-sandbox-mercado-pago.md) | Pix via Mercado Pago em sandbox no MVP | Aceito |
| [007](ADR-007-teto-de-preco.md) | Teto de preço pelo custo de combustível | Aceito |
| [008](ADR-008-reserva-pendente-webhook.md) | Reserva PENDENTE até o webhook de pagamento | Aceito |
| [009](ADR-009-backend-supabase.md) | Backend direto no Supabase (sem Node.js/Express) | Aceito |

## Modelo

```markdown
# ADR-00X: Título

## Status
Proposto | Aceito | Substituído por ADR-00Y

## Data
AAAA-MM-DD

## Contexto
Qual problema ou restrição exige uma decisão.

## Decisão
O que foi decidido.

## Alternativas consideradas
- Opção — por que não

## Consequências
- Positivo: ...
- Negativo: ...
```
