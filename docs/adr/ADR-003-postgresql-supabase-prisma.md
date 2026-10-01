# ADR-003: PostgreSQL no Supabase com Prisma

## Status
Aceito em parte — PostgreSQL no Supabase continua; Prisma e "app não acessa o Supabase diretamente" substituídos por ADR-009 (2026-09-24)

## Data
2026-09-17

## Contexto
O domínio é fortemente relacional (usuários, veículos, caronas, reservas, pagamentos) e exige integridade referencial. Duas reservas simultâneas não podem ocupar a mesma vaga. Orçamento zero.

## Decisão
**PostgreSQL** hospedado no **Supabase** (free tier), acessado pela API via **Prisma ORM**. O app **não** acessa o Supabase diretamente — só a API.

## Alternativas consideradas
- **MongoDB / Firebase** — sem integridade referencial nem transações relacionais naturais para o N:N de reservas.
- **MySQL** — viável, mas sem vantagem sobre o Postgres e com menos opções gratuitas gerenciadas.
- **SQL puro / query builder** — perderia a geração de tipos e as migrations do Prisma.

## Consequências
- Positivo: transações ACID impedem overbooking; FKs garantem consistência.
- Positivo: Prisma gera tipos a partir do schema e aponta erros de consulta em compilação; migrations evitam divergência entre os ambientes do squad.
- Negativo: projeto free do Supabase pausa após inatividade prolongada — reativar antes da demo.
- Negativo: mais estrutura inicial que um banco NoSQL.
