# ADR-002: Node.js + Express com TypeScript na API

## Status
Substituído por ADR-009 (2026-09-24)

## Data
2026-09-17

## Contexto
A API concentra autenticação, rateio, reservas e integrações. O squad precisa produzir rápido e já usa TypeScript no app.

## Decisão
**Node.js 20 LTS + Express**, em **TypeScript strict**, com Zod para validação.

## Alternativas consideradas
- **NestJS** — estrutura boa, mas curva maior (decorators, DI) para o prazo.
- **Fastify** — mais performático, porém menos material de referência para o squad.
- **Java/Spring ou Python/Django** — trocaria de linguagem entre app e API.

## Consequências
- Positivo: mesma linguagem em toda a stack, com tipos compartilháveis entre app e API.
- Positivo: Express tem a menor curva de aprendizado entre os frameworks Node.
- Negativo: Express não impõe estrutura — a organização em módulos (routes → controller → service) precisa ser seguida por convenção (AGENTS.md).
