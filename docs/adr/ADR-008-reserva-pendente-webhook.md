# ADR-008: Reserva PENDENTE até o webhook de pagamento

## Status
Aceito

## Data
2026-09-17

## Contexto
A confirmação do Pix chega por webhook, depois da resposta da requisição de reserva. Se a reserva fosse confirmada na hora, uma vaga poderia ficar ocupada por um pagamento que nunca acontece; se a vaga só fosse ocupada após o pagamento, duas pessoas poderiam pagar pela mesma vaga.

## Decisão
A reserva é criada com status **PENDENTE**, ocupando a vaga dentro de uma transação. Ela passa a **CONFIRMADA** apenas quando o webhook de pagamento aprovado é recebido e validado. Reservas pendentes que ultrapassam o prazo de expiração viram **EXPIRADA** e devolvem a vaga.

## Alternativas consideradas
- **Confirmar na criação** — vagas presas por pagamentos não feitos.
- **Ocupar a vaga só após pagar** — risco de dois pagamentos para a última vaga.
- **Polling do status pelo app** — mais lento e dependente do app aberto.

## Consequências
- Positivo: nenhuma vaga fica bloqueada indefinidamente; sem overbooking.
- Negativo: exige rotina de expiração e webhook idempotente.
- Pendente: prazo de expiração (proposta: 15 minutos) — ver MEMORY.md.
