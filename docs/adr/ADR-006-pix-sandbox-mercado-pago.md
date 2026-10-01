# ADR-006: Pix via Mercado Pago em sandbox no MVP

## Status
Aceito

## Data
2026-09-17

## Contexto
O pagamento dentro do app elimina o constrangimento do acerto em dinheiro. A integração Pix em produção exige CNPJ e conta empresarial, o que não se resolve neste semestre.

## Decisão
Integrar a **API Pix do Mercado Pago em modo sandbox**. A entidade PAGAMENTO já é modelada para a integração definitiva (valor, taxa, repasse, status, id externo).

## Alternativas consideradas
- **Simular o pagamento sem gateway** — não demonstraria o fluxo real nem o webhook.
- **Outros gateways (Stripe, PagSeguro, Asaas)** — Mercado Pago tem sandbox Pix acessível e documentação ampla em português.
- **Acerto fora do app** — contradiz a proposta de valor.

## Consequências
- Positivo: a demo da AP2 mostra o fluxo completo, incluindo o webhook assíncrono.
- Positivo: migrar para produção é trocar credenciais, não código.
- Negativo: repasse ao motorista e reembolso não são executados de fato no MVP — só registrados.
