# ADR-004: Monólito modular exposto como API REST

## Status
Substituído por ADR-009 (2026-09-24)

## Data
2026-09-17

## Contexto
É preciso definir como organizar o backend. O squad tem três pessoas e cinco semanas.

## Decisão
Arquitetura **cliente-servidor em três camadas** (app, API, banco), com backend **monolítico modular**: um único deploy, dividido internamente em módulos (auth, usuarios, veiculos, caronas, reservas, pagamentos, notificacoes, avaliacoes). Comunicação app–API via **REST/JSON**.

## Alternativas consideradas
- **Microsserviços** — resolvem problemas de escala organizacional que não existem num squad de três pessoas; multiplicariam deploy, observabilidade e custo.
- **GraphQL** — flexibilidade desnecessária para telas simples; mais complexidade.
- **Backend-as-a-Service puro (Supabase direto do app)** — colocaria regras de negócio no cliente (ver ADR-005).

## Consequências
- Positivo: um deploy, um repositório, depuração simples.
- Positivo: módulos com fronteiras claras permitem extrair serviços no futuro.
- Negativo: exige disciplina para um módulo não acessar tabelas de outro diretamente.
